export default function Header() {
  return (
    <header className="border-b border-white/10 bg-surface-900/80 backdrop-blur-xl sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">📊</span>
          <div>
            <h1 className="text-xl font-black tracking-tight">
              Line <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">Tracker</span>
            </h1>
            <p className="text-xs text-white/30">Sharp lines • Public money • Line movement</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <a href="https://t.me/blazepickss" target="_blank" className="text-sm text-[#229ED9] hover:text-[#229ED9]/80 font-medium transition">
            Telegram
          </a>
          <a href="https://x.com/drewvibecheck" target="_blank" className="text-sm text-white/50 hover:text-white transition">
            @drewvibecheck
          </a>
        </div>
      </div>
    </header>
  );
}
