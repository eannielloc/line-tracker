'use client';
import { useState, useEffect } from 'react';
import SportTab from '@/components/SportTab';
import GameCard from '@/components/GameCard';
import Header from '@/components/Header';

export interface Game {
  id: string;
  sport: string;
  home: string;
  away: string;
  commence: string;
  spread_home: number | null;
  spread_away: number | null;
  total: number | null;
  ml_home: number | null;
  ml_away: number | null;
  spread_home_open: number | null;
  total_open: number | null;
  ml_home_open: number | null;
  ml_away_open: number | null;
  public_home_pct: number | null;
  public_away_pct: number | null;
  public_over_pct: number | null;
  public_under_pct: number | null;
  sharp_side: string | null;
  sharp_total: string | null;
  snapshot_time: string;
  snapshot_label: string;
}

const SPORTS = [
  { key: 'nba', label: 'NBA', emoji: '🏀' },
  { key: 'nhl', label: 'NHL', emoji: '🏒' },
  { key: 'cbb', label: 'CBB', emoji: '🏀' },
];

export default function Home() {
  const [sport, setSport] = useState('nba');
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [snapshot, setSnapshot] = useState('latest');

  useEffect(() => {
    setLoading(true);
    fetch(`/api/lines?sport=${sport}&date=${date}&snapshot=${snapshot}`)
      .then(r => r.json())
      .then(data => { setGames(data.games || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [sport, date, snapshot]);

  return (
    <div className="min-h-screen bg-surface-900">
      <Header />
      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* Sport Tabs */}
        <div className="flex gap-2 mb-6">
          {SPORTS.map(s => (
            <SportTab key={s.key} active={sport === s.key} onClick={() => setSport(s.key)} emoji={s.emoji} label={s.label} />
          ))}
        </div>

        {/* Date + Snapshot selector */}
        <div className="flex flex-wrap items-center gap-4 mb-6">
          <div className="flex items-center gap-2">
            <label className="text-sm text-white/40">Date:</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-white/30"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-white/40">Snapshot:</label>
            <select
              value={snapshot}
              onChange={e => setSnapshot(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-white/30"
            >
              <option value="latest">Latest</option>
              <option value="10pm">10 PM (Night Before)</option>
              <option value="12pm">12 PM (Game Day)</option>
            </select>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 mb-6 text-xs text-white/40">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400" /> Sharp side</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400" /> Public heavy</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" /> Line movement</span>
        </div>

        {/* Games */}
        {loading ? (
          <div className="text-center py-20 text-white/30">
            <div className="animate-spin w-8 h-8 border-2 border-white/20 border-t-white/60 rounded-full mx-auto mb-4" />
            Loading lines...
          </div>
        ) : games.length === 0 ? (
          <div className="glass p-12 text-center">
            <p className="text-2xl mb-2">📊</p>
            <p className="text-lg text-white/40">No lines available for this date</p>
            <p className="text-sm text-white/20 mt-1">Snapshots are taken at 10 PM and 12 PM daily</p>
          </div>
        ) : (
          <div className="space-y-3">
            {games.map(g => <GameCard key={g.id} game={g} />)}
          </div>
        )}

        {/* Info */}
        <div className="glass p-6 mt-8">
          <h3 className="font-bold text-white/70 mb-3">📖 How to Read This</h3>
          <div className="grid md:grid-cols-2 gap-4 text-sm text-white/40">
            <div>
              <p className="font-semibold text-white/60 mb-1">Sharp Money 🧠</p>
              <p>When the line moves opposite to public betting, sharps are on the other side. This is the strongest signal.</p>
            </div>
            <div>
              <p className="font-semibold text-white/60 mb-1">Public Money 👥</p>
              <p>Shows where the casual bettors are. Fading the public in certain spots is a proven long-term edge.</p>
            </div>
            <div>
              <p className="font-semibold text-white/60 mb-1">Line Movement ↕️</p>
              <p>Compare opening vs current lines. Reverse line movement (line moves against the public) = sharp action.</p>
            </div>
            <div>
              <p className="font-semibold text-white/60 mb-1">Snapshot Times ⏰</p>
              <p>Lines captured at 10 PM (night before) and 12 PM (game day). Compare to spot overnight steam moves.</p>
            </div>
          </div>
        </div>

        <footer className="text-center py-8 mt-8 border-t border-white/5">
          <p className="text-white/30 text-sm">
            Follow{' '}
            <a href="https://x.com/drewvibecheck" target="_blank" className="text-emerald-400 hover:underline">@drewvibecheck</a>
            {' '}on X &nbsp;•&nbsp;{' '}
            <a href="https://t.me/blazepickss" target="_blank" className="text-[#229ED9] hover:underline">Telegram</a>
          </p>
          <p className="text-white/15 text-xs mt-2">Line Tracker — gamble responsibly 🎲</p>
        </footer>
      </main>
    </div>
  );
}
