declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Promise<Response>): void;
};

const teams = {
  celtics: { league: 'nba', code: 'BOS', path: '/v1', id: 2 },
  patriots: { league: 'nfl', code: 'NE', path: '/nfl/v1', id: undefined },
  bruins: { league: 'nhl', code: 'BOS', path: '/nhl/v1', id: undefined },
} as const;
type Team = keyof typeof teams;
type ProviderTeam = { id: number; full_name: string; abbreviation?: string; tricode?: string };
type ProviderGame = {
  id: number;
  status_state?: string;
  datetime?: string;
  date?: string;
  start_time_utc?: string;
  home_team?: ProviderTeam;
  visitor_team?: ProviderTeam;
  away_team?: ProviderTeam;
  home_team_score?: number;
  visitor_team_score?: number;
  home_score?: number;
  away_score?: number;
};
type Game = {
  game_id: string;
  home: ProviderTeam;
  away: ProviderTeam;
  starts_at: string | null;
  status: string;
  home_score: number | null;
  away_score: number | null;
};
const statuses = new Set(['scheduled', 'in_progress', 'final', 'postponed', 'canceled', 'delayed', 'suspended', 'abandoned']);
const day = 86_400_000;

function instant(value: unknown): string | null {
  return typeof value === 'string' && /(?:Z|[+-]\d{2}:\d{2})$/i.test(value) &&
    Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null;
}

async function readPages<T>(url: URL, apiKey: string, signal: AbortSignal) {
  const rows: T[] = [];
  const cursors = new Set<number>();
  while (true) {
    const response = await fetch(url, { headers: { Authorization: apiKey }, signal });
    if (!response.ok) throw new Error(`BALLDONTLIE returned ${response.status}`);
    const page: { data: T[]; meta?: { next_cursor?: number | null } } = await response.json();
    if (!Array.isArray(page.data)) throw new Error('Invalid BALLDONTLIE response');
    rows.push(...page.data);
    const cursor = page.meta?.next_cursor;
    if (cursor == null) return rows;
    if (!Number.isSafeInteger(cursor) || cursors.has(cursor)) throw new Error('Invalid BALLDONTLIE cursor');
    cursors.add(cursor);
    url.searchParams.set('cursor', String(cursor));
  }
}

function normalize(game: ProviderGame, league: string): Game | null {
  const home = game.home_team;
  const away = league === 'nhl' ? game.away_team : game.visitor_team;
  const status = game.status_state;
  if (!Number.isSafeInteger(game.id) || !home?.full_name || !away?.full_name ||
      !Number.isSafeInteger(home.id) || !Number.isSafeInteger(away.id) || !status || !statuses.has(status)) return null;
  const homeScore = league === 'nhl' ? game.home_score : game.home_team_score;
  const awayScore = league === 'nhl' ? game.away_score : game.visitor_team_score;
  if (status === 'final' && (homeScore == null || awayScore == null ||
      !Number.isSafeInteger(homeScore) || !Number.isSafeInteger(awayScore) || homeScore < 0 || awayScore < 0)) return null;
  return {
    game_id: `balldontlie:${league}:${game.id}`, home, away, status,
    starts_at: instant(league === 'nba' ? game.datetime : league === 'nhl' ? game.start_time_utc : game.date),
    home_score: status === 'final' ? homeScore ?? null : null,
    away_score: status === 'final' ? awayScore ?? null : null,
  };
}

function recentScoring(games: Game[], teamId: number, upcomingAt: string) {
  const sample = games.filter((game) => game.status === 'final' && game.starts_at &&
    game.starts_at < upcomingAt && (game.home.id === teamId || game.away.id === teamId)).slice(0, 5);
  if (sample.length < 3) return null;
  let scored = 0;
  let conceded = 0;
  for (const game of sample) {
    const home = game.home.id === teamId;
    scored += (home ? game.home_score : game.away_score)!;
    conceded += (home ? game.away_score : game.home_score)!;
  }
  return { scored: scored / sample.length, conceded: conceded / sample.length };
}

function buildLines(games: Game[], target: number, opponent: number, startsAt: string) {
  const own = recentScoring(games, target, startsAt);
  const other = recentScoring(games, opponent, startsAt);
  if (!own || !other) return null;
  const ownForecast = (own.scored + other.conceded) / 2;
  const otherForecast = (other.scored + own.conceded) / 2;
  const half = (value: number) => Math.floor(value) + 0.5;
  return {
    combined_line: half(ownForecast + otherForecast),
    team_line: half(ownForecast),
    margin_line: half(ownForecast - otherForecast),
  };
}

async function syncTeam(team: Team, apiKey: string, observedAt: string, signal: AbortSignal,
  database: { url: string; headers: Record<string, string> }) {
  const { league, code, path, id } = teams[team];
  const base = `https://api.balldontlie.io${path}`;
  const teamId = id ?? (await readPages<ProviderTeam>(new URL(`${base}/teams`), apiKey, signal))
    .find((row) => (row.abbreviation ?? row.tricode) === code)?.id;
  if (!Number.isSafeInteger(teamId) || teamId == null) throw new Error('Could not identify the team');

  const now = Date.parse(observedAt);
  const year = new Date(now).getUTCFullYear();
  const cutover = team === 'celtics' ? instant(Deno.env.get('CELTICS_PREDICTIONS_CUTOVER_AT')) : observedAt;
  if (!cutover) throw new Error('Celtics cutover timestamp is missing or invalid');
  const upcomingUntil = now + 7 * day;

  async function readGames(ids: number[]) {
    const url = new URL(`${base}/games?per_page=100`);
    for (const teamId of ids) url.searchParams.append('team_ids[]', String(teamId));
    if (league === 'nba') {
      // Keep enough recent games for the scoring sample without paging through two seasons.
      url.searchParams.set('start_date', new Date(now - 60 * day).toISOString().slice(0, 10));
      url.searchParams.set('end_date', new Date(upcomingUntil + day).toISOString().slice(0, 10));
    } else {
      url.searchParams.append('seasons[]', String(year - 1));
      url.searchParams.append('seasons[]', String(year));
    }
    return (await readPages<ProviderGame>(url, apiKey, signal)).map((game) => normalize(game, league))
      .filter((game): game is Game => game !== null);
  }

  const schedule = (await readGames([teamId])).filter((game) => game.home.id === teamId || game.away.id === teamId);
  const opponents = new Set<number>();
  const eligible = (game: Game) => {
    if (game.status !== 'scheduled' || !game.starts_at) return false;
    const start = Date.parse(game.starts_at);
    return start > now && start <= upcomingUntil && game.starts_at >= cutover;
  };
  const candidates = schedule.filter(eligible);
  const published = new Set<string>();
  if (candidates.length) {
    const url = new URL(`${database.url}/team_prediction_games`);
    url.searchParams.set('select', 'game_id');
    url.searchParams.set('game_id', `in.(${candidates.map((game) => game.game_id).join(',')})`);
    const response = await fetch(url, { headers: database.headers, signal });
    if (!response.ok) throw new Error(`Published games lookup returned ${response.status}`);
    const rows: { game_id: string }[] = await response.json();
    for (const row of rows) published.add(row.game_id);
    for (const game of candidates) {
      if (!published.has(game.game_id)) opponents.add(game.home.id === teamId ? game.away.id : game.home.id);
    }
  }
  const history = [...new Map(
    [...schedule, ...(opponents.size ? await readGames([...opponents]) : [])].map((game) => [game.game_id, game]),
  ).values()].sort((a, b) => (b.starts_at ?? '').localeCompare(a.starts_at ?? ''));

  const snapshots = schedule.flatMap((game) => {
    if (game.starts_at) {
      const start = Date.parse(game.starts_at);
      if (start < now - 45 * day) return [];
    }
    const teamIsHome = game.home.id === teamId;
    const lines = eligible(game) && game.starts_at && !published.has(game.game_id)
      ? buildLines(history, teamId, teamIsHome ? game.away.id : game.home.id, game.starts_at) : null;
    return [{
      game_id: game.game_id, starts_at: game.starts_at, status: game.status,
      home_score: game.home_score, away_score: game.away_score,
      home_team_name: game.home.full_name, away_team_name: game.away.full_name,
      team, team_is_home: teamIsHome, observed_at: observedAt, ...lines,
    }];
  });
  return snapshots;
}

Deno.serve(async (request) => {
  const token = Deno.env.get('TEAM_PREDICTIONS_SYNC_TOKEN');
  if (!token || request.headers.get('x-score-sync-token') !== token) return new Response(null, { status: 401 });
  if (request.method !== 'POST') return new Response(null, { status: 405 });

  const apiKey = Deno.env.get('BALLDONTLIE_API_KEY');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!apiKey || !supabaseUrl || !serviceKey) return Response.json({ error: 'Worker configuration is incomplete' }, { status: 503 });
  const database = {
    url: `${supabaseUrl}/rest/v1`,
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
  };
  const observedAt = new Date().toISOString();
  const results: Record<string, number | string> = {};

  const requestedTeam = new URL(request.url).searchParams.get('team');
  if (requestedTeam !== null && !Object.hasOwn(teams, requestedTeam)) {
    return Response.json({ error: 'Unknown team' }, { status: 400 });
  }
  for (const team of Object.keys(teams) as Team[]) {
    if (requestedTeam !== null && requestedTeam !== team) continue;
    if (team === 'celtics' && !Deno.env.get('CELTICS_PREDICTIONS_CUTOVER_AT')) {
      results[team] = 'Waiting for cutover';
      continue;
    }
    try {
      const snapshots = await syncTeam(team, apiKey, observedAt, AbortSignal.timeout(15_000), database);
      const response = await fetch(`${database.url}/rpc/apply_team_prediction_snapshots`, {
        method: 'POST',
        headers: database.headers,
        body: JSON.stringify({ p_games: snapshots }),
        signal: AbortSignal.timeout(8_000),
      });
      if (!response.ok) throw new Error(`Snapshot write returned ${response.status}`);
      results[team] = snapshots.length;
    } catch (error) {
      console.error('Prediction sync failed', team, error instanceof Error ? error.message : 'Unknown error');
      results[team] = 'Sync failed';
    }
  }
  return Response.json(results, { status: Object.values(results).includes('Sync failed') ? 502 : 200 });
});
