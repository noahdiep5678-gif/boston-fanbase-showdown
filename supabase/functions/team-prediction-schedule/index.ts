declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Promise<Response>): void;
};

const leagues = {
  patriots: { league: 'nfl', abbreviation: 'NE' },
  bruins: { league: 'nhl', abbreviation: 'BOS' },
} as const;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, x-client-info, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

type ProviderTeam = { full_name?: string; abbreviation?: string; tricode?: string };
type ProviderGame = {
  id?: number;
  status_state?: string;
  date?: string;
  start_time_utc?: string;
  home_team?: ProviderTeam;
  visitor_team?: ProviderTeam;
  away_team?: ProviderTeam;
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (request.method !== 'GET') {
    return Response.json({ error: 'Use GET.' }, { status: 405, headers: cors });
  }

  const team = new URL(request.url).searchParams.get('team');
  if (team !== 'patriots' && team !== 'bruins') {
    return Response.json({ error: 'Unknown team.' }, { status: 400, headers: cors });
  }
  const apiKey = Deno.env.get('BALLDONTLIE_API_KEY');
  if (!apiKey) {
    return Response.json({ error: 'Schedule provider is unavailable.' }, { status: 503, headers: cors });
  }

  const { league, abbreviation } = leagues[team];
  const url = new URL(`https://api.balldontlie.io/${league}/v1/games`);
  url.searchParams.set('per_page', '100');
  const day = 86_400_000;
  const now = Date.now();
  const end = now + 7 * day;
  // The upstream date may be the venue's calendar date. Include neighboring dates
  // and apply the exact time window to the returned instants.
  for (let offset = -1; offset <= 8; offset++) {
    url.searchParams.append('dates[]', new Date(now + offset * day).toISOString().slice(0, 10));
  }

  try {
    const signal = AbortSignal.timeout(6_000);
    const games = [];
    let cursor: number | null | undefined;
    const seenCursors = new Set<number>();
    do {
      if (cursor != null) url.searchParams.set('cursor', String(cursor));
      const response = await fetch(url, { headers: { Authorization: apiKey }, signal });
      if (!response.ok) throw new Error(`Schedule provider returned ${response.status}.`);
      const page: { data: ProviderGame[]; meta?: { next_cursor?: number | null } } = await response.json();
      if (!Array.isArray(page.data)) throw new Error('Invalid schedule response.');

      for (const game of page.data) {
        const home = game.home_team;
        const away = league === 'nfl' ? game.visitor_team : game.away_team;
        const startsAt = league === 'nfl' ? game.date : game.start_time_utc;
        if (!startsAt || !/(?:Z|[+-]\d{2}:\d{2})$/i.test(startsAt) || game.status_state !== 'scheduled') continue;

        const start = Date.parse(startsAt);
        if (!(start > now && start <= end) || !Number.isSafeInteger(game.id)) continue;
        if (!home?.full_name || !away?.full_name) continue;
        if ((home.abbreviation ?? home.tricode) !== abbreviation &&
            (away.abbreviation ?? away.tricode) !== abbreviation) continue;

        games.push({ id: `${league}:${game.id}`, startsAt, homeTeam: home.full_name, awayTeam: away.full_name });
      }

      cursor = page.meta?.next_cursor;
      if (cursor != null) {
        if (!Number.isSafeInteger(cursor) || seenCursors.has(cursor)) throw new Error('Invalid schedule cursor.');
        seenCursors.add(cursor);
      }
    } while (cursor != null);

    games.sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
    return Response.json({ game: games[0] ?? null }, { headers: cors });
  } catch {
    return Response.json({ error: 'Could not load the schedule.' }, { status: 502, headers: cors });
  }
});
