create table public.team_prediction_games (
  game_id text primary key,
  team text not null check (team in ('celtics', 'patriots', 'bruins')),
  starts_at timestamptz not null,
  closes_at timestamptz not null,
  home_team_name text not null,
  away_team_name text not null,
  team_is_home boolean not null,
  status text not null check (status in ('scheduled', 'in_progress', 'final', 'postponed', 'canceled', 'delayed', 'suspended', 'abandoned')),
  home_score integer check (home_score >= 0),
  away_score integer check (away_score >= 0),
  combined_line numeric not null,
  team_line numeric not null,
  margin_line numeric not null,
  observed_at timestamptz not null,
  check ((status = 'final' and home_score is not null and away_score is not null)
    or (status <> 'final' and home_score is null and away_score is null))
);
create index team_prediction_games_team_date on public.team_prediction_games (team, starts_at);

create table public.team_prediction_picks (
  game_id text not null references public.team_prediction_games,
  user_id uuid not null references auth.users on delete cascade,
  question_id text not null check (question_id in ('combined', 'team', 'margin')),
  choice text not null check (choice in ('over', 'under')),
  primary key (game_id, user_id, question_id)
);

alter table public.team_prediction_games enable row level security;
alter table public.team_prediction_picks enable row level security;
revoke all on public.team_prediction_games, public.team_prediction_picks from anon, authenticated;
grant select on public.team_prediction_picks to authenticated;
grant select (game_id) on public.team_prediction_games to service_role;
create policy read_own_team_prediction_picks on public.team_prediction_picks
  for select to authenticated using (user_id = (select auth.uid()));

-- All client writes use this function. The worker and pick writer serialize on the game row.
create function public.save_team_prediction_pick(p_game_id text, p_question_id text, p_choice text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  fan uuid := auth.uid();
  game public.team_prediction_games%rowtype;
begin
  if fan is null then raise exception 'Sign in to make a pick'; end if;
  select * into game from public.team_prediction_games where game_id = p_game_id for update;
  if not found or game.status <> 'scheduled' or clock_timestamp() >= game.closes_at then
    raise exception 'Picks are closed for this game';
  end if;
  insert into public.team_prediction_picks (game_id, user_id, question_id, choice)
  values (p_game_id, fan, p_question_id, p_choice)
  on conflict (game_id, user_id, question_id) do update set choice = excluded.choice;
end;
$$;
revoke all on function public.save_team_prediction_pick(text, text, text) from public, anon, authenticated;
grant execute on function public.save_team_prediction_pick(text, text, text) to authenticated;

-- A previously published line never changes. Earlier deadlines may lock picks
-- sooner, and a delay or postponement never reopens a closed game.
create function public.apply_team_prediction_snapshot(p_game jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  item public.team_prediction_games%rowtype := jsonb_populate_record(null::public.team_prediction_games, p_game);
  legacy_exists boolean;
begin
  perform pg_advisory_xact_lock(hashtextextended(item.game_id, 0));
  update public.team_prediction_games as game
  set starts_at = coalesce(item.starts_at, game.starts_at),
      closes_at = case when item.status = 'scheduled' then least(game.closes_at, item.starts_at)
                       else least(game.closes_at, clock_timestamp()) end,
      status = item.status,
      home_score = item.home_score,
      away_score = item.away_score,
      observed_at = item.observed_at
  where game.game_id = item.game_id
    and game.team = item.team
    and game.team_is_home = item.team_is_home
    and game.observed_at < item.observed_at
    and (game.status <> 'final' or item.status = 'final');

  if found or item.status <> 'scheduled' or item.starts_at is null or item.starts_at <= clock_timestamp()
      or item.combined_line is null or item.team_line is null or item.margin_line is null then
    return;
  end if;

  -- Leave any already registered Celtics game in the existing system.
  if item.team = 'celtics' and to_regclass('public.celtics_prediction_games') is not null then
    execute 'select exists (select 1 from public.celtics_prediction_games where game_id = $1)'
      into legacy_exists using split_part(item.game_id, ':', 3)::bigint;
    if legacy_exists then return; end if;
  end if;

  item.closes_at := item.starts_at;
  insert into public.team_prediction_games select item.*
  on conflict (game_id) do nothing;
end;
$$;
revoke all on function public.apply_team_prediction_snapshot(jsonb) from public, anon, authenticated;
grant execute on function public.apply_team_prediction_snapshot(jsonb) to service_role;

create function public.apply_team_prediction_snapshots(p_games jsonb)
returns void language sql security definer set search_path = '' as $$
  select public.apply_team_prediction_snapshot(item)
  from jsonb_array_elements(p_games) as games(item)
  order by item->>'game_id';
$$;
revoke all on function public.apply_team_prediction_snapshots(jsonb) from public, anon, authenticated;
grant execute on function public.apply_team_prediction_snapshots(jsonb) to service_role;

create function public.team_prediction_slate(p_team text)
returns jsonb language sql stable security definer set search_path = '' as $$
  with picked_games as (
    (select 'upcoming' as slot, game.*
      from public.team_prediction_games game
      where game.team = p_team and game.status = 'scheduled' and game.starts_at > now()
      order by game.starts_at, game.game_id limit 1)
    union all
    (select 'latest' as slot, game.*
      from public.team_prediction_games game
      where game.team = p_team and game.status = 'final'
      order by game.starts_at desc, game.game_id limit 1)
  ),
  cards as (
    select game.slot, jsonb_build_object(
      'game_id', game.game_id, 'starts_at', game.starts_at, 'closes_at', game.closes_at,
      'home_team_name', game.home_team_name, 'away_team_name', game.away_team_name,
      'home_score', game.home_score, 'away_score', game.away_score,
      'questions', (
        select jsonb_agg(jsonb_build_object(
          'question_id', q.id, 'question', q.label, 'threshold', q.line,
          'choice', picks.choice, 'actual', q.actual,
          'correct_choice', case when q.actual > q.line then 'over'
            when q.actual < q.line then 'under' when q.actual = q.line then 'push' end
        ) order by q.position)
        from (values
          (1, 'combined', 'Combined ' || case when game.team = 'bruins' then 'goals' else 'points' end,
            game.combined_line, game.home_score + game.away_score),
          (2, 'team', initcap(game.team) || case when game.team = 'bruins' then ' goals' else ' points' end,
            game.team_line, case when game.team_is_home then game.home_score else game.away_score end),
          (3, 'margin', initcap(game.team) || ' scoring margin', game.margin_line,
            case when game.team_is_home then game.home_score - game.away_score
              else game.away_score - game.home_score end)
        ) as q(position, id, label, line, actual)
        left join public.team_prediction_picks picks on picks.game_id = game.game_id
          and picks.question_id = q.id and picks.user_id = auth.uid()
      )
    ) as card from picked_games game
  )
  select jsonb_build_object(
    'active', exists (select 1 from public.team_prediction_games where team = p_team),
    'upcoming', (select card from cards where slot = 'upcoming'),
    'latest', (select card from cards where slot = 'latest')
  );
$$;
revoke all on function public.team_prediction_slate(text) from public;
grant execute on function public.team_prediction_slate(text) to anon, authenticated;
