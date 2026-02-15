import type { Game } from '@/lib/sharp';
import { detectSharpMoney, hasSharpAction } from '@/lib/sharp';

function formatSpread(n: number | null) {
  if (n === null) return '—';
  return n > 0 ? `+${n}` : `${n}`;
}

const SPORT_EMOJI: Record<string, string> = { nba: '🏀', nhl: '🏒', cbb: '🎓' };
const SPORT_COLOR: Record<string, string> = {
  nba: 'border-orange-500/30 bg-orange-500/5',
  nhl: 'border-blue-500/30 bg-blue-500/5',
  cbb: 'border-purple-500/30 bg-purple-500/5',
};

export default function SharpSection({ games }: { games: Game[] }) {
  const sharpGames = games.filter(hasSharpAction);
  if (sharpGames.length === 0) return null;

  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xl animate-fire">🔥</span>
        <h2 className="text-lg font-black bg-gradient-to-r from-orange-400 to-red-500 bg-clip-text text-transparent">
          SHARP MONEY ALERTS
        </h2>
        <span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full font-bold">
          {sharpGames.length} {sharpGames.length === 1 ? 'GAME' : 'GAMES'}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sharpGames.map(game => {
          const alerts = detectSharpMoney(game);
          return (
            <div key={game.id + '-sharp'} className={`glass-fire p-4 ${SPORT_COLOR[game.sport] || ''}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-white/40 uppercase">
                  {SPORT_EMOJI[game.sport]} {game.sport}
                </span>
                <div className="flex gap-1">
                  {game.rlm_side && <span className="sharp-badge">RLM 🧠</span>}
                  {game.steam_move && <span className="steam-badge">STEAM ⚡</span>}
                </div>
              </div>
              <div className="font-bold text-white mb-1">
                {game.away} @ {game.home}
              </div>
              <div className="text-xs text-white/40 mb-2">
                {game.spread_home_open !== null && (
                  <span>Spread: {formatSpread(game.spread_home_open)} → {formatSpread(game.spread_home)}</span>
                )}
                {game.total_open !== null && game.total !== null && (
                  <span className="ml-3">Total: {game.total_open} → {game.total}</span>
                )}
              </div>
              {alerts.map((alert, i) => (
                <div key={i} className="text-xs mt-1">
                  <span className={`font-bold ${alert.type === 'rlm' ? 'text-orange-400' : 'text-yellow-400'}`}>
                    {alert.type === 'rlm' ? '🧠' : '⚡'} Sharp on {alert.side}
                  </span>
                  <span className="text-white/30 ml-1">— {alert.description}</span>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
