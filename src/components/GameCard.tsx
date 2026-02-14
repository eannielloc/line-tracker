import type { Game } from '@/app/page';

function formatOdds(n: number | null): string {
  if (n === null) return '—';
  return n > 0 ? `+${n}` : `${n}`;
}

function spreadChange(current: number | null, open: number | null): { text: string; color: string } | null {
  if (current === null || open === null) return null;
  const diff = current - open;
  if (Math.abs(diff) < 0.5) return null;
  const arrow = diff > 0 ? '↑' : '↓';
  return { text: `${arrow} ${Math.abs(diff).toFixed(1)}`, color: 'text-amber-400' };
}

function totalChange(current: number | null, open: number | null): { text: string; color: string } | null {
  if (current === null || open === null) return null;
  const diff = current - open;
  if (Math.abs(diff) < 0.5) return null;
  const arrow = diff > 0 ? '↑' : '↓';
  return { text: `${arrow} ${Math.abs(diff).toFixed(1)}`, color: 'text-amber-400' };
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
        <span className={`${left > right ? 'text-red-400' : 'text-white/40'} ${isLeftSharp ? 'font-bold text-emerald-400' : ''}`}>
          {leftLabel} {left}% {isLeftSharp && '🧠'}
        </span>
        <span className={`${right > left ? 'text-red-400' : 'text-white/40'} ${isRightSharp ? 'font-bold text-emerald-400' : ''}`}>
          {right}% {rightLabel} {isRightSharp && '🧠'}
        </span>
      </div>
      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden flex">
        <div className={`h-full ${isLeftSharp ? 'bg-emerald-400' : left > 60 ? 'bg-red-400' : 'bg-white/30'} transition-all`} style={{ width: `${left}%` }} />
        <div className={`h-full ${isRightSharp ? 'bg-emerald-400' : right > 60 ? 'bg-red-400' : 'bg-white/30'} transition-all`} style={{ width: `${right}%` }} />
      </div>
    </div>
  );
}

export default function GameCard({ game }: { game: Game }) {
  const time = new Date(game.commence).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const sChange = spreadChange(game.spread_home, game.spread_home_open);
  const tChange = totalChange(game.total, game.total_open);

  return (
    <div className="glass p-5 hover:bg-white/[0.07] transition-all">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-xs text-white/30 font-mono">{time}</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/40 uppercase font-bold tracking-wider">
            {game.sport}
          </span>
        </div>
        {game.snapshot_label && (
          <span className="text-xs text-white/20">{game.snapshot_label}</span>
        )}
      </div>

      {/* Teams + Lines */}
      <div className="grid grid-cols-12 gap-4 items-center mb-4">
        <div className="col-span-4">
          <div className="font-bold text-white/90 text-lg">{game.away}</div>
          <div className="font-bold text-white/60 text-lg mt-1">@ {game.home}</div>
        </div>
        <div className="col-span-8 grid grid-cols-3 gap-3 text-center">
          {/* Spread */}
          <div className="glass p-3">
            <div className="text-xs text-white/30 mb-1">SPREAD</div>
            <div className="font-bold text-white">
              {game.spread_home !== null ? (game.spread_home > 0 ? `+${game.spread_home}` : game.spread_home) : '—'}
            </div>
            {game.spread_home_open !== null && (
              <div className="text-xs text-white/20 mt-0.5">open: {game.spread_home_open > 0 ? `+${game.spread_home_open}` : game.spread_home_open}</div>
            )}
            {sChange && <div className={`text-xs font-bold mt-0.5 ${sChange.color}`}>{sChange.text}</div>}
          </div>
          {/* Total */}
          <div className="glass p-3">
            <div className="text-xs text-white/30 mb-1">TOTAL</div>
            <div className="font-bold text-white">{game.total ?? '—'}</div>
            {game.total_open !== null && (
              <div className="text-xs text-white/20 mt-0.5">open: {game.total_open}</div>
            )}
            {tChange && <div className={`text-xs font-bold mt-0.5 ${tChange.color}`}>{tChange.text}</div>}
          </div>
          {/* ML */}
          <div className="glass p-3">
            <div className="text-xs text-white/30 mb-1">ML</div>
            <div className="font-bold text-white text-sm">
              {formatOdds(game.ml_away)}
            </div>
            <div className="font-bold text-white/60 text-sm mt-0.5">
              {formatOdds(game.ml_home)}
            </div>
          </div>
        </div>
      </div>

      {/* Public + Sharp Money */}
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <div className="text-xs text-white/30 font-bold mb-2 uppercase tracking-wider">Spread — Public Money</div>
          <PctBar
            left={game.public_home_pct}
            right={game.public_away_pct}
            leftLabel={game.home}
            rightLabel={game.away}
            sharp={game.sharp_side}
          />
        </div>
        <div>
          <div className="text-xs text-white/30 font-bold mb-2 uppercase tracking-wider">Total — Public Money</div>
          <PctBar
            left={game.public_under_pct}
            right={game.public_over_pct}
            leftLabel="Under"
            rightLabel="Over"
            sharp={game.sharp_total}
          />
        </div>
      </div>
    </div>
  );
}
