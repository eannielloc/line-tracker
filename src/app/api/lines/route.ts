import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const ODDS_API_KEY = process.env.ODDS_API_KEY || '';

const SPORT_KEYS: Record<string, string> = {
  nba: 'basketball_nba',
  nhl: 'icehockey_nhl',
  cbb: 'basketball_ncaab',
};

interface OddsOutcome {
  name: string;
  price: number;
  point?: number;
}

interface OddsMarket {
  key: string;
  outcomes: OddsOutcome[];
}

interface OddsBookmaker {
  key: string;
  title: string;
  markets: OddsMarket[];
}

interface OddsEvent {
  id: string;
  sport_key: string;
  home_team: string;
  away_team: string;
  commence_time: string;
  bookmakers: OddsBookmaker[];
}

// Simple in-memory cache (5 min TTL)
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

  // Estimate public money (favorites get 55-70%)
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
    snapshot_time: new Date().toISOString(),
    snapshot_label: 'live',
  };
}

async function fetchLiveOdds(sport: string) {
  const cacheKey = `live_${sport}`;
  const cached = cache[cacheKey];
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.data;
  }

  const apiKey = SPORT_KEYS[sport];
  if (!apiKey || !ODDS_API_KEY) return [];

  const url = `https://api.the-odds-api.com/v4/sports/${apiKey}/odds/?apiKey=${ODDS_API_KEY}&regions=us&markets=spreads,totals,h2h&oddsFormat=american&bookmakers=draftkings,fanduel,betmgm`;
  const res = await fetch(url);
  if (!res.ok) return [];

  const data: OddsEvent[] = await res.json();
  const games = data.map(g => parseGame(g, sport));

  cache[cacheKey] = { data: games, ts: Date.now() };
  return games;
}

function loadSnapshot(date: string, sport: string, snapshot: string) {
  const dataDir = path.join(process.cwd(), 'data');
  let filename = `${date}_${sport}`;
  if (snapshot === '10pm') filename += '_10pm';
  else if (snapshot === '12pm') filename += '_12pm';
  else filename += '_latest';

  const filePath = path.join(dataDir, `${filename}.json`);
  if (fs.existsSync(filePath)) {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  }

  // Fallback: any snapshot for this date + sport
  if (fs.existsSync(dataDir)) {
    const files = fs.readdirSync(dataDir)
      .filter(f => f.startsWith(`${date}_${sport}`) && f.endsWith('.json'))
      .sort()
      .reverse();
    if (files.length > 0) {
      return JSON.parse(fs.readFileSync(path.join(dataDir, files[0]), 'utf-8'));
    }
  }
  return [];
}

export async function GET(req: NextRequest) {
  const sport = req.nextUrl.searchParams.get('sport') || 'nba';
  const date = req.nextUrl.searchParams.get('date') || new Date().toISOString().slice(0, 10);
  const snapshot = req.nextUrl.searchParams.get('snapshot') || 'latest';

  let games;

  // If requesting today + latest and we have API key, fetch live
  const today = new Date().toISOString().slice(0, 10);
  if (date === today && snapshot === 'latest' && ODDS_API_KEY) {
    games = await fetchLiveOdds(sport);
  } else {
    games = loadSnapshot(date, sport, snapshot);
  }

  return NextResponse.json({ games, sport, date, snapshot });
}
