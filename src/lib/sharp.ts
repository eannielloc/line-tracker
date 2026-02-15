// Sharp money detection utilities

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
  steam_move: boolean;
  rlm_side: boolean;
  rlm_total: boolean;
  snapshot_time: string;
  snapshot_label: string;
}

export interface SharpAlert {
  game: Game;
  type: 'rlm' | 'steam';
  description: string;
  side: string;
}

export function detectSharpMoney(game: Game): SharpAlert[] {
  const alerts: SharpAlert[] = [];

  // RLM on spread
  if (game.spread_home !== null && game.spread_home_open !== null && game.public_home_pct !== null) {
    const spreadMoved = game.spread_home - game.spread_home_open;
    if (game.public_home_pct > 55 && spreadMoved > 0) {
      alerts.push({
        game,
        type: 'rlm',
        description: `${game.public_home_pct}% public on ${game.home}, but line moved from ${game.spread_home_open} → ${game.spread_home}`,
        side: game.away,
      });
    } else if (game.public_away_pct !== null && game.public_away_pct > 55 && spreadMoved < 0) {
      alerts.push({
        game,
        type: 'rlm',
        description: `${game.public_away_pct}% public on ${game.away}, but line moved from ${game.spread_home_open} → ${game.spread_home}`,
        side: game.home,
      });
    }
  }

  // RLM on total
  if (game.total !== null && game.total_open !== null && game.public_over_pct !== null) {
    const totalMoved = game.total - game.total_open;
    if (game.public_over_pct > 55 && totalMoved < 0) {
      alerts.push({
        game,
        type: 'rlm',
        description: `${game.public_over_pct}% public on Over, but total dropped from ${game.total_open} → ${game.total}`,
        side: 'Under',
      });
    } else if (game.public_under_pct !== null && game.public_under_pct > 55 && totalMoved > 0) {
      alerts.push({
        game,
        type: 'rlm',
        description: `${game.public_under_pct}% public on Under, but total rose from ${game.total_open} → ${game.total}`,
        side: 'Over',
      });
    }
  }

  // Steam moves (1.5+ point movement)
  if (game.steam_move) {
    const spreadDiff = game.spread_home !== null && game.spread_home_open !== null
      ? Math.abs(game.spread_home - game.spread_home_open) : 0;
    const totalDiff = game.total !== null && game.total_open !== null
      ? Math.abs(game.total - game.total_open) : 0;

    if (spreadDiff >= 1.5) {
      const direction = (game.spread_home! - game.spread_home_open!) > 0 ? game.away : game.home;
      alerts.push({
        game,
        type: 'steam',
        description: `Spread moved ${spreadDiff.toFixed(1)} pts: ${game.spread_home_open} → ${game.spread_home}`,
        side: direction,
      });
    }
    if (totalDiff >= 1.5) {
      const direction = (game.total! - game.total_open!) > 0 ? 'Over' : 'Under';
      alerts.push({
        game,
        type: 'steam',
        description: `Total moved ${totalDiff.toFixed(1)} pts: ${game.total_open} → ${game.total}`,
        side: direction,
      });
    }
  }

  return alerts;
}

export function hasSharpAction(game: Game): boolean {
  return game.sharp_side !== null || game.sharp_total !== null || game.steam_move || game.rlm_side || game.rlm_total;
}
