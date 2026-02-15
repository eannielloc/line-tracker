'use client';
import { useState, useEffect, useMemo } from 'react';
import SportTab from '@/components/SportTab';
import GameCard from '@/components/GameCard';
import Header from '@/components/Header';
import SharpSection from '@/components/SharpSection';
import type { Game } from '@/lib/sharp';

const SPORTS = [
  { key: 'all', label: 'ALL', emoji: '🔥' },
  { key: 'nba', label: 'NBA', emoji: '🏀' },
  { key: 'nhl', label: 'NHL', emoji: '🏒' },
  { key: 'cbb', label: 'CBB', emoji: '🎓' },
];

export default function Home() {
  const [sport, setSport] = useState('all');
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [snapshot, setSnapshot] = useState('latest');
  const [updated, setUpdated] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/lines?sport=${sport}&date=${date}&snapshot=${snapshot}`)
      .then(r => r.json())
      .then(data => {
        setGames(data.games || []);
        setUpdated(data.updated || null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [sport, date, snapshot]);

  const filteredGames = useMemo(() => {
    if (sport === 'all') return games;
    return games.filter(g => g.sport === sport);
  }, [games, sport]);

  const sportCounts = useMemo(() => {
    const counts: Record<string, number> = { all: games.length, nba: 0, nhl: 0, cbb: 0 };
    games.forEach(g => { counts[g.sport] = (counts[g.sport] || 0) + 1; });
    return counts;
  }, [games]);

  // Sort: sharp games first, then by commence time
  const sortedGames = useMemo(() => {
    return [...filteredGames].sort((a, b) => {
      const aSharp = (a.sharp_side || a.sharp_total || a.steam_move || a.rlm_side) ? 1 : 0;
      const bSharp = (b.sharp_side || b.sharp_total || b.steam_move || b.rlm_side) ? 1 : 0;
      if (aSharp !== bSharp) return bSharp - aSharp;
      return new Date(a.commence).getTime() - new Date(b.commence).getTime();
    });
  }, [filteredGames]);

  return (
    <div className="min-h-screen bg-surface-900">
      <Header />
      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* Sport Tabs */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {SPORTS.map(s => (
            <SportTab key={s.key} active={sport === s.key} onClick={() => setSport(s.key)} emoji={s.emoji} label={s.label} count={sportCounts[s.key]} />
          ))}
        </div>

        {/* Controls row */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs text-white/30">Date:</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-orange-500/50"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-white/30">Snapshot:</label>
              <select
                value={snapshot}
                onChange={e => setSnapshot(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-orange-500/50"
              >
                <option value="latest">Latest</option>
                <option value="10pm">10 PM (Night Before)</option>
                <option value="12pm">12 PM (Game Day)</option>
              </select>
            </div>
          </div>
          {updated && (
            <div className="text-xs text-white/20">
              Updated: {new Date(updated).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            </div>
          )}
        </div>

        {loading ? (
          <div className="text-center py-20 text-white/30">
            <div className="animate-spin w-8 h-8 border-2 border-orange-500/20 border-t-orange-500 rounded-full mx-auto mb-4" />
            Loading lines...
          </div>
        ) : filteredGames.length === 0 ? (
          <div className="glass p-12 text-center">
            <p className="text-2xl mb-2">📊</p>
            <p className="text-lg text-white/40">No lines available</p>
            <p className="text-sm text-white/20 mt-1">Try a different date or sport</p>
          </div>
        ) : (
          <>
            {/* Sharp Money Section */}
            <SharpSection games={filteredGames} />

            {/* All Games */}
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-sm font-bold text-white/40 uppercase tracking-wider">
                All Games ({sortedGames.length})
              </h2>
            </div>
            <div className="space-y-3">
              {sortedGames.map(g => <GameCard key={g.id} game={g} />)}
            </div>
          </>
        )}

        {/* Legend */}
        <div className="glass p-5 mt-8">
          <h3 className="font-bold text-white/60 mb-3 text-sm">📖 How to Read This</h3>
          <div className="grid sm:grid-cols-2 gap-4 text-xs text-white/40">
            <div>
              <p className="font-semibold text-orange-400 mb-1">🧠 Reverse Line Movement (RLM)</p>
              <p>Line moves OPPOSITE to where the public is betting. The strongest sharp money signal.</p>
            </div>
            <div>
              <p className="font-semibold text-yellow-400 mb-1">⚡ Steam Moves</p>
              <p>Line moves 1.5+ points from open. Rapid movement indicates syndicate action.</p>
            </div>
            <div>
              <p className="font-semibold text-red-400 mb-1">👥 Public Money</p>
              <p>Estimated public betting %. Favorites and overs get heavy public action. Fade wisely.</p>
            </div>
            <div>
              <p className="font-semibold text-amber-400 mb-1">↕️ Line Movement</p>
              <p>Open → Current spread/total. Compare to spot where the smart money landed.</p>
            </div>
          </div>
        </div>

        <footer className="text-center py-8 mt-8 border-t border-white/5">
          <p className="text-white/30 text-sm">
            <a href="https://x.com/drewvibecheck" target="_blank" className="text-orange-400 hover:underline">@drewvibecheck</a>
            {' '}•{' '}
            <a href="https://t.me/blazepickss" target="_blank" className="text-[#229ED9] hover:underline">Telegram</a>
          </p>
          <p className="text-white/15 text-xs mt-2">Blaze Line Tracker — gamble responsibly 🎲</p>
        </footer>
      </main>
    </div>
  );
}
