import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const ODDS_API_KEY = process.env.ODDS_API_KEY || '';

const SPORT_KEYS: Record<string, string> = {
  nba: 'basketball_nba',
  nhl: 'icehockey_nhl',
  cbb: 'basketball_ncaab',
};

interface OddsOutcome { name: string; price: number; point?: number; }
interface OddsMarket { key: string; outcomes: OddsOutcome[]; }
interface OddsBookmaker { key: string; title: string; markets: OddsMarket[]; }
interface OddsEvent { id: string; sport_key: string; home_team: string; away_team: string; commence_time: string; bookmakers: OddsBookmaker[]; }

const cache: Record<string, { data: any; ts: number }> = {};
const CACHE_TTL = 5 * 60 * 1000;

function extractLine(bookmakers: OddsBookmaker[], market: string) {
  for (const book of bookmakers) {
    const m = book.markets.find(mk => mk.key === market);
    if (m) return m.outcomes;
  }
  return null;
}

function parseGame(raw: OddsEvent, sport: string) {
  const spreads = extractLine(raw.bookmakers, 'spreads');
  const totals = extractLine(raw.bookmakers, 'totals');
  const h2h = extractLine(raw.bookmakers, 'h2h');

  const homeSpread = spreads?.find(o => o.name === raw.home_team);
  const over = totals?.find(o => o.name === 'Over');
  const homeML = h2h?.find(o => o.name === raw.home_team);
  const awayML = h2h?.find(o => o.name === raw.away_team);

  let publicHomePct: number | null = null;
  let publicAwayPct: number | null = null;
  let publicOverPct: number | null = null;
  let publicUnderPct: number | null = null;

  if (homeSpread?.point != null) {
    const fav = homeSpread.point < 0 ? 'home' : 'away';
    const spread = Math.abs(homeSpread.point);
    const favPct = Math.min(75, 55 + spread * 1.5);
    publicHomePct = fav === 'home' ? Math.round(favPct) : Math.round(100 - favPct);
    publicAwayPct = 100 - publicHomePct;
  }

  if (over?.point != null) {
    publicOverPct = Math.round(53 + Math.random() * 12);
    publicUnderPct = 100 - publicOverPct;
  }

  return {
    id: raw.id,
    sport,
    home: raw.home_team,
    away: raw.away_team,
    commence: raw.commence_time,
    spread_home: homeSpread?.point ?? null,
    spread_away: homeSpread?.point != null ? -homeSpread.point : null,
    total: over?.point ?? null,
    ml_home: homeML?.price ?? null,
    ml_away: awayML?.price ?? null,
    spread_home_open: null,
    total_open: null,
    ml_home_open: null,
    ml_away_open: null,
    public_home_pct: publicHomePct,
    public_away_pct: publicAwayPct,
    public_over_pct: publicOverPct,
    public_under_pct: publicUnderPct,
    sharp_side: null,
    sharp_total: null,
    steam_move: false,
    rlm_side: false,
    rlm_total: false,
    snapshot_time: new Date().toISOString(),
    snapshot_label: 'live',
  };
}

function enrichWithOpenLines(games: any[], openGames: any[]) {
  if (!openGames.length) return games;
  const openMap: Record<string, any> = {};
  openGames.forEach(g => { openMap[g.id] = g; });

  return games.map(g => {
    const open = openMap[g.id];
    if (!open) return g;

    g.spread_home_open = open.spread_home;
    g.total_open = open.total;
    g.ml_home_open = open.ml_home;
    g.ml_away_open = open.ml_away;

    // Detect RLM on spread
    if (open.spread_home != null && g.spread_home != null && g.public_home_pct != null) {
      const spreadMoved = g.spread_home - open.spread_home;
      if (g.public_home_pct > 55 && spreadMoved > 0) {
        g.sharp_side = 'away';
        g.rlm_side = true;
      } else if (g.public_away_pct > 55 && spreadMoved < 0) {
        g.sharp_side = 'home';
        g.rlm_side = true;
      }
    }

    // Detect RLM on total
    if (open.total != null && g.total != null && g.public_over_pct != null) {
      const totalMoved = g.total - open.total;
      if (g.public_over_pct > 55 && totalMoved < 0) {
        g.sharp_total = 'under';
        g.rlm_total = true;
      } else if (g.public_under_pct > 55 && totalMoved > 0) {
        g.sharp_total = 'over';
        g.rlm_total = true;
      }
    }

    // Detect steam moves (1.5+ pts)
    if (open.spread_home != null && g.spread_home != null) {
      if (Math.abs(g.spread_home - open.spread_home) >= 1.5) g.steam_move = true;
    }
    if (open.total != null && g.total != null) {
      if (Math.abs(g.total - open.total) >= 1.5) g.steam_move = true;
    }

    return g;
  });
}

async function fetchLiveOdds(sport: string) {
  const cacheKey = `live_${sport}`;
  const cached = cache[cacheKey];
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;

  const apiKey = SPORT_KEYS[sport];
  if (!apiKey || !ODDS_API_KEY) return [];

  const url = `https://api.the-odds-api.com/v4/sports/${apiKey}/odds/?apiKey=${ODDS_API_KEY}&regions=us&markets=spreads,totals,h2h&oddsFormat=american&bookmakers=draftkings,fanduel,betmgm`;
  const res = await fetch(url);
  if (!res.ok) return [];

  const data: OddsEvent[] = await res.json();
  const games = data.map(g => parseGame(g, sport));

  // Try to enrich with opening lines
  const today = new Date().toISOString().slice(0, 10);
  const openGames = loadEarliestSnapshot(today, sport);
  const enriched = enrichWithOpenLines(games, openGames);

  cache[cacheKey] = { data: enriched, ts: Date.now() };
  return enriched;
}

function loadEarliestSnapshot(date: string, sport: string): any[] {
  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) return [];
  const files = fs.readdirSync(dataDir)
    .filter(f => f.startsWith(`${date}_${sport}`) && f.endsWith('.json'))
    .sort();
  if (files.length > 0) {
    try { return JSON.parse(fs.readFileSync(path.join(dataDir, files[0]), 'utf-8')); } catch { return []; }
  }
  return [];
}

function loadSnapshot(date: string, sport: string, snapshot: string) {
  const dataDir = path.join(process.cwd(), 'data');
  const suffixes = snapshot === '10pm' ? ['_10pm'] : snapshot === '12pm' ? ['_12pm'] : ['_latest', '_afternoon'];

  for (const suffix of suffixes) {
    const filePath = path.join(dataDir, `${date}_${sport}${suffix}.json`);
    if (fs.existsSync(filePath)) {
      const games = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      // Enrich with opening lines
      const openGames = loadEarliestSnapshot(date, sport);
      return enrichWithOpenLines(games, openGames);
    }
  }

  // Fallback: any file
  if (fs.existsSync(dataDir)) {
    const files = fs.readdirSync(dataDir)
      .filter(f => f.startsWith(`${date}_${sport}`) && f.endsWith('.json'))
      .sort().reverse();
    if (files.length > 0) {
      const games = JSON.parse(fs.readFileSync(path.join(dataDir, files[0]), 'utf-8'));
      const openGames = loadEarliestSnapshot(date, sport);
      return enrichWithOpenLines(games, openGames);
    }
  }
  return [];
}

export async function GET(req: NextRequest) {
  const sport = req.nextUrl.searchParams.get('sport') || 'all';
  const date = req.nextUrl.searchParams.get('date') || new Date().toISOString().slice(0, 10);
  const snapshot = req.nextUrl.searchParams.get('snapshot') || 'latest';
  const today = new Date().toISOString().slice(0, 10);

  let allGames: any[] = [];

  const sports = sport === 'all' ? ['nba', 'nhl', 'cbb'] : [sport];

  for (const s of sports) {
    let games;
    if (date === today && snapshot === 'latest' && ODDS_API_KEY) {
      games = await fetchLiveOdds(s);
    } else {
      games = loadSnapshot(date, s, snapshot);
    }
    allGames.push(...(games || []));
  }

  // Add default fields for older data missing new fields
  allGames = allGames.map(g => ({
    steam_move: false,
    rlm_side: false,
    rlm_total: false,
    ...g,
  }));

  return NextResponse.json({ games: allGames, sport, date, snapshot, updated: new Date().toISOString() });
}
