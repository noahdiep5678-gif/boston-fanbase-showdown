create schema if not exists stadium_private;

create table stadium_private.daily_scores (
  user_id uuid not null references auth.users on delete cascade,
  puzzle_date date not null,
  section text not null,
  game text not null,
  points integer not null check (points between 0 and 1000),
  primary key (user_id, puzzle_date, section, game)
);
alter table stadium_private.daily_scores enable row level security;
create index daily_scores_by_date on stadium_private.daily_scores (puzzle_date);

create function public.submit_ranked_daily(p_game text, p_section text, p_date date, p_answers jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  fan uuid := auth.uid();
  today date := (now() at time zone 'America/New_York')::date;
  category text;
  puzzle jsonb;
  points integer;
  answer_count integer;
begin
  if fan is null or p_date is null or p_date not between today - 1 and today
     or jsonb_typeof(p_answers) is distinct from 'array' or octet_length(p_answers::text) > 8192 then
    raise exception using errcode = '22023', message = 'Invalid ranked round';
  end if;

  category := case
    when p_game = 'wicked-smaht' and p_section in ('celtics', 'patriots', 'bruins') then p_section
    when p_game = 'timeline' and p_section in ('celtics', 'patriots', 'bruins', 'boston') then 'timeline-' || p_section
    when p_game = 'mystery-player' and p_section = 'patriots' then 'mystery-patriots'
    when p_game = 'boston-trivia' and p_section = 'boston' then 'boston'
    when p_game = 'where-in-boston' and p_section = 'boston' then 'where-in-boston'
  end;
  select roster_data into puzzle from public.daily_puzzles
    where team = category and puzzle_date = p_date;
  if puzzle is null then
    raise exception using errcode = '22023', message = 'No ranked puzzle for this round';
  end if;

  answer_count := jsonb_array_length(p_answers);
  case p_game
    when 'wicked-smaht' then
      if answer_count > 10 or jsonb_typeof(puzzle->'answers') is distinct from 'array'
         or exists (select from jsonb_array_elements(p_answers) a where jsonb_typeof(a) <> 'string') then
        raise exception using errcode = '22023', message = 'Invalid roster answers';
      end if;
      select 100 * count(distinct a.value) into points
        from jsonb_array_elements_text(p_answers) a
        where (puzzle->'answers') ? a.value;
    when 'boston-trivia' then
      if answer_count <> 3 or jsonb_array_length(puzzle->'questions') is distinct from 3
         or exists (select from jsonb_array_elements(p_answers) a where a not in ('0', '1', '2')) then
        raise exception using errcode = '22023', message = 'Invalid trivia answers';
      end if;
      select round(1000.0 * count(*) / 3) into points
        from jsonb_array_elements(puzzle->'questions') with ordinality q(value, position)
        where q.value->'correct' = p_answers->((q.position - 1)::integer);
    when 'timeline' then
      if answer_count <> 5 or jsonb_array_length(puzzle->'events') is distinct from 5
         or (select count(distinct value) from jsonb_array_elements(p_answers)) <> 5
         or exists (
           select from jsonb_array_elements(p_answers) a
           where not exists (select from jsonb_array_elements(puzzle->'events') e where e->'text' = a)
         ) then
        raise exception using errcode = '22023', message = 'Invalid timeline order';
      end if;
      select 200 * count(*) into points
        from (
          select value, row_number() over (order by (value->>'year')::integer) as position
          from jsonb_array_elements(puzzle->'events')
        ) e where e.value->'text' = p_answers->((e.position - 1)::integer);
    when 'mystery-player' then
      if answer_count not between 1 and 6 or jsonb_typeof(puzzle->'player') is distinct from 'string'
         or exists (select from jsonb_array_elements(p_answers) a where jsonb_typeof(a) <> 'string')
         or (select count(distinct value) from jsonb_array_elements(p_answers)) <> answer_count
         or (p_answers - (answer_count - 1)) ? (puzzle->>'player')
         or (answer_count < 6 and p_answers->(answer_count - 1) <> puzzle->'player') then
        raise exception using errcode = '22023', message = 'Invalid mystery guesses';
      end if;
      points := case when p_answers->(answer_count - 1) = puzzle->'player'
        then round(1000.0 * (7 - answer_count) / 6) else 0 end;
    when 'where-in-boston' then
      if answer_count <> 3 or jsonb_array_length(puzzle->'locations') is distinct from 3
         or exists (select from jsonb_array_elements(p_answers) a
           where jsonb_typeof(a->'latitude') is distinct from 'number'
              or jsonb_typeof(a->'longitude') is distinct from 'number') then
        raise exception using errcode = '22023', message = 'Invalid map guesses';
      end if;
      if exists (select from jsonb_array_elements(p_answers) a
        where abs((a->>'latitude')::numeric) > 90 or abs((a->>'longitude')::numeric) > 180) then
        raise exception using errcode = '22023', message = 'Map guesses out of bounds';
      end if;
      select round(avg(round((1000 * greatest(0, 1 - greatest(0, distance - 100) / 4900))::numeric)))
        into points
        from (
          select 12742000 * asin(sqrt(least(1,
            power(sin(radians((target->>'latitude')::double precision - (guess->>'latitude')::double precision) / 2), 2)
            + cos(radians((target->>'latitude')::double precision)) * cos(radians((guess->>'latitude')::double precision))
              * power(sin(radians((target->>'longitude')::double precision - (guess->>'longitude')::double precision) / 2), 2)
          ))) as distance
          from jsonb_array_elements(puzzle->'locations') with ordinality l(value, position)
          cross join lateral (select l.value->'coordinate' as target, p_answers->((l.position - 1)::integer) as guess) coordinates
        ) distances;
  end case;

  insert into stadium_private.daily_scores (user_id, puzzle_date, section, game, points)
  values (fan, p_date, p_section, p_game, points) on conflict do nothing;
  return (select s.points from stadium_private.daily_scores s
    where (s.user_id, s.puzzle_date, s.section, s.game) = (fan, p_date, p_section, p_game));
end;
$$;

revoke all on function public.submit_ranked_daily(text, text, date, jsonb) from public, anon, authenticated;
grant execute on function public.submit_ranked_daily(text, text, date, jsonb) to authenticated;

-- Staging uses the shared prediction tables only. The legacy Celtics feed still runs in production.
do $migration$
begin
  if to_regclass('public.celtics_prediction_games') is not null then
    execute $view$
      create view stadium_private.celtics_prediction_results as
      select p.user_id, g.starts_at, g.game_id::text as game_id, p.choice, q.threshold,
        case q.scoring_type
          when 'combined_points' then g.final_home_score + g.final_away_score
          when 'celtics_points' then case when g.home_team_name ilike '%Celtics%' then g.final_home_score else g.final_away_score end
          when 'celtics_margin' then case when g.home_team_name ilike '%Celtics%' then g.final_home_score - g.final_away_score else g.final_away_score - g.final_home_score end
        end::numeric as actual
      from public.celtics_prediction_games g
      join public.celtics_prediction_questions q using (game_id)
      join public.celtics_prediction_picks p using (game_id, question_id)
      where g.final_home_score is not null and g.final_away_score is not null
    $view$;
  else
    create view stadium_private.celtics_prediction_results as
      select null::uuid as user_id, null::timestamptz as starts_at, null::text as game_id,
        null::text as choice, null::numeric as threshold, null::numeric as actual where false;
  end if;
end;
$migration$;

create function public.weekly_fan_rankings(p_board text)
returns table (place integer, fan_name text, points bigint, rounds bigint, is_you boolean)
language sql stable security definer set search_path = '' as $$
  with week as (
    select date_trunc('week', now() at time zone 'America/New_York') as monday
  ), prediction_grades as (
    select p.user_id, g.team as section, g.game_id, p.choice, q.threshold, q.actual
    from week w
    join public.team_prediction_games g on g.starts_at >= w.monday at time zone 'America/New_York'
      and g.starts_at < (w.monday + interval '7 days') at time zone 'America/New_York'
    join public.team_prediction_picks p on p.game_id = g.game_id
    cross join lateral (
      select case p.question_id when 'combined' then g.combined_line when 'team' then g.team_line else g.margin_line end as threshold,
        case p.question_id when 'combined' then g.home_score + g.away_score
          when 'team' then case when g.team_is_home then g.home_score else g.away_score end
          else case when g.team_is_home then g.home_score - g.away_score else g.away_score - g.home_score end
        end as actual
    ) q
    where g.status = 'final' and (p_board = 'superfans' or g.team = p_board)
    union all
    select p.user_id, 'celtics', 'legacy:' || p.game_id, p.choice, p.threshold, p.actual
    from week w join stadium_private.celtics_prediction_results p
      on p.starts_at >= w.monday at time zone 'America/New_York'
      and p.starts_at < (w.monday + interval '7 days') at time zone 'America/New_York'
    where p_board in ('superfans', 'celtics')
  ), scores as (
    select s.user_id, s.points
    from stadium_private.daily_scores s cross join week w
    where s.puzzle_date >= w.monday::date and s.puzzle_date < w.monday::date + 7
      and (p_board = 'superfans' or s.section = p_board)
    union all
    -- Award one third per correct pick. A push earns no points and a push-only card is omitted.
    select g.user_id, round(1000.0 * count(*) filter (
      where g.choice = case when g.actual > g.threshold then 'over' else 'under' end
    ) / 3)::integer
    from prediction_grades g where g.actual <> g.threshold
    group by g.user_id, g.section, g.game_id
  ), totals as (
    select s.user_id, sum(s.points) as points, count(*) as rounds
    from scores s group by s.user_id
  ), ranked as (
    select t.*, row_number() over (order by t.points desc, t.rounds desc, t.user_id) as place
    from totals t
  )
  select r.place::integer, 'Fan ' || upper(left(md5('stadium-pulse:' || r.user_id::text), 10)),
    r.points, r.rounds, coalesce(r.user_id = auth.uid(), false)
  from ranked r where r.place <= 5 or r.user_id = auth.uid() order by r.place;
$$;

revoke all on function public.weekly_fan_rankings(text) from public, anon, authenticated;
grant execute on function public.weekly_fan_rankings(text) to anon, authenticated;
