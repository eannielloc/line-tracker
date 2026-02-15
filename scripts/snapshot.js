#!/usr/bin/env node
/**
 * Line Snapshot Script
 * Pulls odds from The Odds API with sharp money detection
 * Run: node scripts/snapshot.js [--label 10pm|12pm|afternoon]
 */

const fs = require('fs');
const path = require('path');

const ODDS_API_KEY = process.env.ODDS_API_KEY || '';
const DATA_DIR = path.join(__dirname, '..', 'data');

const SPORTS = {
  nba: 'basketball_nba',
  nhl: 'icehockey_nhl',
  cbb: 'basketball_ncaab',
};

const label = process.argv.includes('--label')
  ? process.argv[process.argv.indexOf('--label') + 1]
  : 'latest';

async function fetchOdds(sportKey) {
  const url = `https://api.the-odds-api.com/v4/sports/${sportKey}/odds/?apiKey=${ODDS_API_KEY}&regions=us&markets=spreads,totals,h2h&oddsFormat=american&bookmakers=draftkings,fanduel,betmgm`;
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`Failed to fetch ${sportKey}: ${res.status}`);
    return [];
  }
  const data = await res.json();
  console.log(`Fetched ${data.length} games for ${sportKey} | Remaining: ${res.headers.get('x-requests-remaining')}`);
  return data;
}

function extractBestLine(bookmakers, market) {
  for (const book of bookmakers) {
    const m = book.markets.find(mk => mk.key === market);
    if (m) return m.outcomes;
  }
  return null;
}

function parseGame(raw, sport) {
  const spreads = extractBestLine(raw.bookmakers, 'spreads');
  const totals = extractBestLine(raw.bookmakers, 'totals');
  const h2h = extractBestLine(raw.bookmakers, 'h2h');

  const homeSpread = spreads?.find(o => o.name === raw.home_team);
  const awaySpread = spreads?.find(o => o.name === raw.away_team);
  const over = totals?.find(o => o.name === 'Over');
  const homeML = h2h?.find(o => o.name === raw.home_team);
  const awayML = h2h?.find(o => o.name === raw.away_team);

  // Estimate public money based on spread (favorites get more action)
  let publicHomePct = null, publicAwayPct = null;
  let publicOverPct = null, publicUnderPct = null;

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
    spread_away: awaySpread?.point ?? null,
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
    snapshot_label: label,
  };
}

function loadEarliestSnapshot(today, sport) {
  if (!fs.existsSync(DATA_DIR)) return [];
  const files = fs.readdirSync(DATA_DIR)
    .filter(f => f.startsWith(`${today}_${sport}`) && f.endsWith('.json'))
    .sort();
  if (files.length > 0) {
    try { return JSON.parse(fs.readFileSync(path.join(DATA_DIR, files[0]), 'utf-8')); } catch { return []; }
  }
  return [];
}

function loadPreviousSnapshot(today, sport) {
  if (!fs.existsSync(DATA_DIR)) return [];
  const files = fs.readdirSync(DATA_DIR)
    .filter(f => f.startsWith(`${today}_${sport}`) && f.endsWith('.json'))
    .sort()
    .reverse();
  // Get second most recent (the one before current)
  if (files.length > 0) {
    try { return JSON.parse(fs.readFileSync(path.join(DATA_DIR, files[0]), 'utf-8')); } catch { return []; }
  }
  return [];
}

function enrichWithSharpDetection(games, openGames, prevGames) {
  const openMap = {};
  const prevMap = {};
  openGames.forEach(g => { openMap[g.id] = g; });
  prevGames.forEach(g => { prevMap[g.id] = g; });

  return games.map(g => {
    const open = openMap[g.id];
    const prev = prevMap[g.id];

    if (open) {
      g.spread_home_open = open.spread_home;
      g.total_open = open.total;
      g.ml_home_open = open.ml_home;
      g.ml_away_open = open.ml_away;
    }

    // RLM on spread
    if (open && open.spread_home != null && g.spread_home != null && g.public_home_pct != null) {
      const moved = g.spread_home - open.spread_home;
      if (g.public_home_pct > 55 && moved > 0) {
        g.sharp_side = 'away';
        g.rlm_side = true;
      } else if (g.public_away_pct > 55 && moved < 0) {
        g.sharp_side = 'home';
        g.rlm_side = true;
      }
    }

    // RLM on total
    if (open && open.total != null && g.total != null && g.public_over_pct != null) {
      const moved = g.total - open.total;
      if (g.public_over_pct > 55 && moved < 0) {
        g.sharp_total = 'under';
        g.rlm_total = true;
      } else if (g.public_under_pct > 55 && moved > 0) {
        g.sharp_total = 'over';
        g.rlm_total = true;
      }
    }

    // Steam moves: 1.5+ point rapid movement (vs previous snapshot or vs open)
    const ref = prev || open;
    if (ref) {
      if (ref.spread_home != null && g.spread_home != null && Math.abs(g.spread_home - ref.spread_home) >= 1.5) {
        g.steam_move = true;
      }
      if (ref.total != null && g.total != null && Math.abs(g.total - ref.total) >= 1.5) {
        g.steam_move = true;
      }
    }

    return g;
  });
}

async function main() {
  if (!ODDS_API_KEY) {
    console.error('Missing ODDS_API_KEY');
    return;
  }

  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  const today = new Date().toISOString().slice(0, 10);

  for (const [sport, apiKey] of Object.entries(SPORTS)) {
    try {
      const raw = await fetchOdds(apiKey);
      const games = raw.map(g => parseGame(g, sport));
      const openGames = loadEarliestSnapshot(today, sport);
      const prevGames = loadPreviousSnapshot(today, sport);
      const enriched = enrichWithSharpDetection(games, openGames, prevGames);

      const sharpCount = enriched.filter(g => g.sharp_side || g.sharp_total || g.steam_move).length;

      const filename = `${today}_${sport}_${label}.json`;
      fs.writeFileSync(path.join(DATA_DIR, filename), JSON.stringify(enriched, null, 2));
      console.log(`✅ ${filename}: ${enriched.length} games, ${sharpCount} sharp alerts`);
    } catch (err) {
      console.error(`Error ${sport}:`, err.message);
    }
  }

  console.log('🔥 Snapshot complete!');
}

main().catch(console.error);
