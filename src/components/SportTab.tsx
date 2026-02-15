interface Props {
  active: boolean;
  onClick: () => void;
  emoji: string;
  label: string;
  count?: number;
}

const SPORT_COLORS: Record<string, string> = {
  ALL: 'from-orange-500/20 to-red-500/20 border-orange-500/30 shadow-orange-500/10',
  NBA: 'from-orange-500/20 to-amber-500/20 border-orange-500/30 shadow-orange-500/10',
  NHL: 'from-blue-500/20 to-cyan-500/20 border-blue-500/30 shadow-blue-500/10',
  CBB: 'from-purple-500/20 to-pink-500/20 border-purple-500/30 shadow-purple-500/10',
};

export default function SportTab({ active, onClick, emoji, label, count }: Props) {
  const colors = SPORT_COLORS[label] || SPORT_COLORS.ALL;
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-xl font-bold text-sm transition-all duration-200 flex items-center gap-1.5 ${
        active
          ? `bg-gradient-to-r ${colors} border text-white shadow-lg`
          : 'bg-white/5 border border-white/10 text-white/50 hover:text-white hover:bg-white/10'
      }`}
    >
      {emoji} {label}
      {count !== undefined && count > 0 && (
        <span className="ml-1 text-xs bg-white/10 px-1.5 py-0.5 rounded-full">{count}</span>
      )}
    </button>
  );
}
