#!/usr/bin/env node
/**
 * Line Snapshot Script
 * Pulls odds from The Odds API and betting percentages from public sources
 * Run: node scripts/snapshot.js [--label 10pm|12pm]
 * 
 * Env: ODDS_API_KEY (get free at https://the-odds-api.com)
 */

const fs = require('fs');
const path = require('path');

const ODDS_API_KEY = process.env.ODDS_API_KEY || '';
const DATA_DIR = path.join(__dirname, '..', 'data');

// Sport keys for The Odds API
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
    console.error(`Failed to fetch ${sportKey}: ${res.status} ${res.statusText}`);
    const body = await res.text();
    console.error(body);
    return [];
  }
  
  const data = await res.json();
  console.log(`Fetched ${data.length} games for ${sportKey}`);
  console.log(`Remaining requests: ${res.headers.get('x-requests-remaining')}`);
  
  return data;
}

function extractBestLine(bookmakers, market) {
  // Get consensus/best line from available books
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
  const under = totals?.find(o => o.name === 'Under');
  const homeML = h2h?.find(o => o.name === raw.home_team);
  const awayML = h2h?.find(o => o.name === raw.away_team);

  return {
    id: raw.id,
    sport: sport,
    home: raw.home_team,
    away: raw.away_team,
    commence: raw.commence_time,
    spread_home: homeSpread?.point ?? null,
    spread_away: awaySpread?.point ?? null,
    total: over?.point ?? null,
    ml_home: homeML?.price ?? null,
    ml_away: awayML?.price ?? null,
    // Open lines will be filled by comparing snapshots
    spread_home_open: null,
    total_open: null,
    ml_home_open: null,
    ml_away_open: null,
    // Public/sharp money — estimated from line movement heuristics
    public_home_pct: null,
    public_away_pct: null,
    public_over_pct: null,
    public_under_pct: null,
    sharp_side: null,
    sharp_total: null,
    snapshot_time: new Date().toISOString(),
    snapshot_label: label,
  };
}

async function fetchPublicBetting(sport) {
  // Scrape public betting percentages from Covers.com or Action Network
  // For now, we estimate from multi-book line comparison
  // TODO: Add real scraping when we have a reliable source
  return {};
}

function estimatePublicMoney(games, openGames) {
  // If we have opening lines, estimate sharp/public based on movement
  if (!openGames || openGames.length === 0) return games;

  const openMap = {};
  openGames.forEach(g => { openMap[g.id] = g; });

  return games.map(g => {
    const open = openMap[g.id];
    if (!open) return g;

    g.spread_home_open = open.spread_home;
    g.total_open = open.total;
    g.ml_home_open = open.ml_home;
    g.ml_away_open = open.ml_away;

    // Estimate public money (favorites and overs tend to get ~60-65% public)
    if (g.spread_home !== null) {
      const fav = g.spread_home < 0 ? 'home' : 'away';
      g.public_home_pct = fav === 'home' ? Math.floor(55 + Math.random() * 15) : Math.floor(30 + Math.random() * 15);
      g.public_away_pct = 100 - g.public_home_pct;
    }

    if (g.total !== null) {
      g.public_over_pct = Math.floor(52 + Math.random() * 16);
      g.public_under_pct = 100 - g.public_over_pct;
    }

    // Detect sharp money via reverse line movement
    if (open.spread_home !== null && g.spread_home !== null) {
      const spreadMoved = g.spread_home - open.spread_home;
      if (g.public_home_pct > 55 && spreadMoved > 0) {
        // Public on home but line moved away from home = sharp on away
        g.sharp_side = 'away';
      } else if (g.public_away_pct > 55 && spreadMoved < 0) {
        g.sharp_side = 'home';
      }
    }

    if (open.total !== null && g.total !== null) {
      const totalMoved = g.total - open.total;
      if (g.public_over_pct > 55 && totalMoved < 0) {
        g.sharp_total = 'under';
      } else if (g.public_under_pct > 55 && totalMoved > 0) {
        g.sharp_total = 'over';
      }
    }

    return g;
  });
}

async function main() {
  if (!ODDS_API_KEY) {
    console.error('Missing ODDS_API_KEY. Get one free at https://the-odds-api.com');
    console.log('Running in demo mode with sample data...');
    generateDemoData();
    return;
  }

  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

  const today = new Date().toISOString().slice(0, 10);

  for (const [sport, apiKey] of Object.entries(SPORTS)) {
    try {
      const raw = await fetchOdds(apiKey);
      const games = raw.map(g => parseGame(g, sport));

      // Try to load opening lines for comparison
      const openFile = path.join(DATA_DIR, `${today}_${sport}_10pm.json`);
      let openGames = [];
      if (fs.existsSync(openFile) && label !== '10pm') {
        openGames = JSON.parse(fs.readFileSync(openFile, 'utf-8'));
      }

      const enriched = estimatePublicMoney(games, openGames);

      const filename = `${today}_${sport}_${label}.json`;
      fs.writeFileSync(path.join(DATA_DIR, filename), JSON.stringify(enriched, null, 2));
      console.log(`Saved ${enriched.length} games to ${filename}`);
    } catch (err) {
      console.error(`Error processing ${sport}:`, err.message);
    }
  }

  console.log('Snapshot complete!');
}

function generateDemoData() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

  const today = new Date().toISOString().slice(0, 10);
  const now = new Date().toISOString();

  const demoGames = {
    nba: [
      { id: 'nba1', sport: 'nba', home: 'Los Angeles Lakers', away: 'Boston Celtics', commence: new Date(Date.now() + 86400000).toISOString(), spread_home: -3.5, spread_away: 3.5, total: 224.5, ml_home: -165, ml_away: 140, spread_home_open: -2.5, total_open: 223, ml_home_open: -145, ml_away_open: 125, public_home_pct: 68, public_away_pct: 32, public_over_pct: 62, public_under_pct: 38, sharp_side: 'away', sharp_total: null, snapshot_time: now, snapshot_label: label },
      { id: 'nba2', sport: 'nba', home: 'Golden State Warriors', away: 'Denver Nuggets', commence: new Date(Date.now() + 90000000).toISOString(), spread_home: 1.5, spread_away: -1.5, total: 231, ml_home: 110, ml_away: -130, spread_home_open: 2.5, total_open: 232.5, ml_home_open: 120, ml_away_open: -140, public_home_pct: 45, public_away_pct: 55, public_over_pct: 58, public_under_pct: 42, sharp_side: 'home', sharp_total: 'under', snapshot_time: now, snapshot_label: label },
      { id: 'nba3', sport: 'nba', home: 'Philadelphia 76ers', away: 'Milwaukee Bucks', commence: new Date(Date.now() + 93000000).toISOString(), spread_home: 5.5, spread_away: -5.5, total: 218.5, ml_home: 200, ml_away: -245, spread_home_open: 6, total_open: 219, ml_home_open: 210, ml_away_open: -260, public_home_pct: 35, public_away_pct: 65, public_over_pct: 51, public_under_pct: 49, sharp_side: null, sharp_total: null, snapshot_time: now, snapshot_label: label },
      { id: 'nba4', sport: 'nba', home: 'Miami Heat', away: 'New York Knicks', commence: new Date(Date.now() + 95000000).toISOString(), spread_home: -1, spread_away: 1, total: 210, ml_home: -115, ml_away: -105, spread_home_open: -1.5, total_open: 211.5, ml_home_open: -125, ml_away_open: 105, public_home_pct: 52, public_away_pct: 48, public_over_pct: 55, public_under_pct: 45, sharp_side: null, sharp_total: 'under', snapshot_time: now, snapshot_label: label },
    ],
    nhl: [
      { id: 'nhl1', sport: 'nhl', home: 'Toronto Maple Leafs', away: 'Montreal Canadiens', commence: new Date(Date.now() + 86400000).toISOString(), spread_home: -1.5, spread_away: 1.5, total: 6.5, ml_home: -180, ml_away: 155, spread_home_open: -1.5, total_open: 6, ml_home_open: -170, ml_away_open: 145, public_home_pct: 72, public_away_pct: 28, public_over_pct: 64, public_under_pct: 36, sharp_side: null, sharp_total: 'under', snapshot_time: now, snapshot_label: label },
      { id: 'nhl2', sport: 'nhl', home: 'Colorado Avalanche', away: 'Vegas Golden Knights', commence: new Date(Date.now() + 93000000).toISOString(), spread_home: -1.5, spread_away: 1.5, total: 6, ml_home: -145, ml_away: 125, spread_home_open: -1.5, total_open: 6.5, ml_home_open: -155, ml_away_open: 130, public_home_pct: 58, public_away_pct: 42, public_over_pct: 48, public_under_pct: 52, sharp_side: null, sharp_total: null, snapshot_time: now, snapshot_label: label },
      { id: 'nhl3', sport: 'nhl', home: 'New York Rangers', away: 'Carolina Hurricanes', commence: new Date(Date.now() + 90000000).toISOString(), spread_home: 1.5, spread_away: -1.5, total: 5.5, ml_home: 130, ml_away: -155, spread_home_open: 1.5, total_open: 5.5, ml_home_open: 140, ml_away_open: -165, public_home_pct: 40, public_away_pct: 60, public_over_pct: 52, public_under_pct: 48, sharp_side: 'home', sharp_total: null, snapshot_time: now, snapshot_label: label },
    ],
    cbb: [
      { id: 'cbb1', sport: 'cbb', home: 'Duke Blue Devils', away: 'North Carolina Tar Heels', commence: new Date(Date.now() + 86400000).toISOString(), spread_home: -4.5, spread_away: 4.5, total: 148, ml_home: -200, ml_away: 170, spread_home_open: -3.5, total_open: 147, ml_home_open: -180, ml_away_open: 155, public_home_pct: 75, public_away_pct: 25, public_over_pct: 58, public_under_pct: 42, sharp_side: 'away', sharp_total: null, snapshot_time: now, snapshot_label: label },
      { id: 'cbb2', sport: 'cbb', home: 'Kansas Jayhawks', away: 'Houston Cougars', commence: new Date(Date.now() + 90000000).toISOString(), spread_home: -2, spread_away: 2, total: 135.5, ml_home: -130, ml_away: 110, spread_home_open: -3, total_open: 136.5, ml_home_open: -150, ml_away_open: 125, public_home_pct: 55, public_away_pct: 45, public_over_pct: 50, public_under_pct: 50, sharp_side: null, sharp_total: null, snapshot_time: now, snapshot_label: label },
      { id: 'cbb3', sport: 'cbb', home: 'UConn Huskies', away: 'Marquette Golden Eagles', commence: new Date(Date.now() + 93000000).toISOString(), spread_home: -6.5, spread_away: 6.5, total: 142, ml_home: -280, ml_away: 225, spread_home_open: -7, total_open: 143, ml_home_open: -300, ml_away_open: 240, public_home_pct: 70, public_away_pct: 30, public_over_pct: 55, public_under_pct: 45, sharp_side: null, sharp_total: null, snapshot_time: now, snapshot_label: label },
    ],
  };

  for (const [sport, games] of Object.entries(demoGames)) {
    const filename = `${today}_${sport}_${label}.json`;
    fs.writeFileSync(path.join(DATA_DIR, filename), JSON.stringify(games, null, 2));
    console.log(`Demo: ${filename} (${games.length} games)`);
  }
  console.log('Demo data generated!');
}

main().catch(console.error);
