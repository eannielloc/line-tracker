import type { Game } from '@/lib/sharp';
import { hasSharpAction } from '@/lib/sharp';

function formatOdds(n: number | null): string {
  if (n === null) return '—';
  return n > 0 ? `+${n}` : `${n}`;
}

function MovementArrow({ current, open, invert }: { current: number | null; open: number | null; invert?: boolean }) {
  if (current === null || open === null) return null;
  const diff = current - open;
  if (Math.abs(diff) < 0.5) return null;
  const arrow = diff > 0 ? '↑' : '↓';
  // For spreads, moving toward negative = line getting bigger for home fav
  const color = 'text-amber-400';
  return (
    <span className={`text-xs font-bold ${color}`}>
      {arrow}{Math.abs(diff).toFixed(1)}
    </span>
  );
}

function PctBar({ left, right, leftLabel, rightLabel, sharp }: {
  left: number | null;
  right: number | null;
  leftLabel: string;
  rightLabel: string;
  sharp?: string | null;
}) {
  if (left === null || right === null) return <div className="text-xs text-white/20">No data</div>;
  const isLeftSharp = sharp === 'home' || sharp === 'under';
  const isRightSharp = sharp === 'away' || sharp === 'over';
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className={`truncate max-w-[45%] ${isLeftSharp ? 'font-bold text-orange-400' : left > right ? 'text-red-400' : 'text-white/40'}`}>
          {isLeftSharp && '🧠 '}{leftLabel} {left}%
        </span>
        <span className={`truncate max-w-[45%] text-right ${isRightSharp ? 'font-bold text-orange-400' : right > left ? 'text-red-400' : 'text-white/40'}`}>
          {right}% {rightLabel}{isRightSharp && ' 🧠'}
        </span>
      </div>
      <div className="h-2 bg-white/10 rounded-full overflow-hidden flex">
        <div
          className={`h-full rounded-l-full transition-all ${isLeftSharp ? 'bg-gradient-to-r from-orange-500 to-orange-400' : left > 60 ? 'bg-red-500/70' : 'bg-white/25'}`}
          style={{ width: `${left}%` }}
        />
        <div
          className={`h-full rounded-r-full transition-all ${isRightSharp ? 'bg-gradient-to-r from-orange-400 to-orange-500' : right > 60 ? 'bg-red-500/70' : 'bg-white/25'}`}
          style={{ width: `${right}%` }}
        />
      </div>
    </div>
  );
}

const SPORT_BORDER: Record<string, string> = {
  nba: 'sport-nba',
  nhl: 'sport-nhl',
  cbb: 'sport-cbb',
};

export default function GameCard({ game }: { game: Game }) {
  const time = new Date(game.commence).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const sharp = hasSharpAction(game);

  return (
    <div className={`glass p-4 sm:p-5 hover:bg-white/[0.07] transition-all ${SPORT_BORDER[game.sport] || ''} ${sharp ? 'ring-1 ring-orange-500/20' : ''}`}>
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-white/30 font-mono">{time}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-bold tracking-wider uppercase ${
            game.sport === 'nba' ? 'bg-orange-500/15 text-orange-400' :
            game.sport === 'nhl' ? 'bg-blue-500/15 text-blue-400' :
            'bg-purple-500/15 text-purple-400'
          }`}>
            {game.sport}
          </span>
          {game.rlm_side && <span className="sharp-badge">SHARP 🔥</span>}
          {game.steam_move && <span className="steam-badge">STEAM ⚡</span>}
        </div>
      </div>

      {/* Teams + Lines */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center mb-4">
        <div className="sm:col-span-4">
          <div className="font-bold text-white/90 text-base sm:text-lg">{game.away}</div>
          <div className="font-bold text-white/50 text-base sm:text-lg">@ {game.home}</div>
        </div>
        <div className="sm:col-span-8 grid grid-cols-3 gap-2 text-center">
          {/* Spread */}
          <div className="glass p-2 sm:p-3">
            <div className="text-[10px] text-white/30 mb-1">SPREAD</div>
            <div className="font-bold text-white text-sm sm:text-base">
              {formatOdds(game.spread_home)}
            </div>
            {game.spread_home_open !== null && (
              <div className="text-[10px] text-white/20 mt-0.5 flex items-center justify-center gap-1">
                {formatOdds(game.spread_home_open)} → {formatOdds(game.spread_home)}
                <MovementArrow current={game.spread_home} open={game.spread_home_open} />
              </div>
            )}
          </div>
          {/* Total */}
          <div className="glass p-2 sm:p-3">
            <div className="text-[10px] text-white/30 mb-1">TOTAL</div>
            <div className="font-bold text-white text-sm sm:text-base">{game.total ?? '—'}</div>
            {game.total_open !== null && (
              <div className="text-[10px] text-white/20 mt-0.5 flex items-center justify-center gap-1">
                {game.total_open} → {game.total}
                <MovementArrow current={game.total} open={game.total_open} />
              </div>
            )}
          </div>
          {/* ML */}
          <div className="glass p-2 sm:p-3">
            <div className="text-[10px] text-white/30 mb-1">ML</div>
            <div className="font-bold text-white text-xs sm:text-sm">{formatOdds(game.ml_away)}</div>
            <div className="font-bold text-white/50 text-xs sm:text-sm mt-0.5">{formatOdds(game.ml_home)}</div>
          </div>
        </div>
      </div>

      {/* Public Money Bars */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <div className="text-[10px] text-white/30 font-bold mb-1.5 uppercase tracking-wider">Spread — Public Money</div>
          <PctBar left={game.public_home_pct} right={game.public_away_pct} leftLabel={game.home.split(' ').pop() || game.home} rightLabel={game.away.split(' ').pop() || game.away} sharp={game.sharp_side} />
        </div>
        <div>
          <div className="text-[10px] text-white/30 font-bold mb-1.5 uppercase tracking-wider">Total — Public Money</div>
          <PctBar left={game.public_under_pct} right={game.public_over_pct} leftLabel="Under" rightLabel="Over" sharp={game.sharp_total} />
        </div>
      </div>
    </div>
  );
}
