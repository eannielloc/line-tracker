import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(req: NextRequest) {
  const sport = req.nextUrl.searchParams.get('sport') || 'nba';
  const date = req.nextUrl.searchParams.get('date') || new Date().toISOString().slice(0, 10);
  const snapshot = req.nextUrl.searchParams.get('snapshot') || 'latest';

  const dataDir = path.join(process.cwd(), 'data');

  // Try to load the specific snapshot
  let filename = `${date}_${sport}`;
  if (snapshot === '10pm') filename += '_10pm';
  else if (snapshot === '12pm') filename += '_12pm';
  else filename += '_latest';

  const filePath = path.join(dataDir, `${filename}.json`);

  // Try exact file, then fallback to latest
  let games = [];
  if (fs.existsSync(filePath)) {
    games = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } else {
    // Try any snapshot for this date + sport
    const files = fs.existsSync(dataDir) ? fs.readdirSync(dataDir) : [];
    const matches = files
      .filter(f => f.startsWith(`${date}_${sport}`) && f.endsWith('.json'))
      .sort()
      .reverse();
    if (matches.length > 0) {
      games = JSON.parse(fs.readFileSync(path.join(dataDir, matches[0]), 'utf-8'));
    }
  }

  return NextResponse.json({ games, sport, date, snapshot });
}
