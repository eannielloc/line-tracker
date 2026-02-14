interface Props {
  active: boolean;
  onClick: () => void;
  emoji: string;
  label: string;
}

export default function SportTab({ active, onClick, emoji, label }: Props) {
  return (
    <button
      onClick={onClick}
      className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all duration-200 ${
        active
          ? 'bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 text-white shadow-lg shadow-emerald-500/10'
          : 'bg-white/5 border border-white/10 text-white/50 hover:text-white hover:bg-white/10'
      }`}
    >
      {emoji} {label}
    </button>
  );
}
