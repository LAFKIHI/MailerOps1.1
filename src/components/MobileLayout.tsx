import { Link, useLocation } from 'react-router-dom';
import { useAppContext } from '../App';
import { useState } from 'react';

const TABS = [
  { to: '/', label: 'Dashboard', icon: '🏠', activeIcon: '🏠' },
  { to: '/servers', label: 'Serveurs', icon: '🖥️', activeIcon: '🖥️' },
  { to: '/deliveries', label: 'Envois', icon: '📬', activeIcon: '📬' },
  { to: '/domains', label: 'Domaines', icon: '🌐', activeIcon: '🌐' },
  { to: '/analytics', label: 'Analyses', icon: '📊', activeIcon: '📊' },
  { to: '/settings', label: 'Paramètres', icon: '⚙️', activeIcon: '⚙️' },
];

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAppContext();
  const location = useLocation();
  const [notifOpen, setNotifOpen] = useState(false);

  const isActive = (to: string) => {
    if (to === '/') return location.pathname === '/';
    return location.pathname.startsWith(to);
  };

  return (
    <div className="mobile-app flex flex-col min-h-screen bg-background">
      {/* ─── Top Header Bar ─── */}
      <header className="mobile-header sticky top-0 z-30 flex items-center justify-between px-5 h-[60px] bg-background/90 backdrop-blur-xl border-b border-border/50">
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-white text-sm font-black shadow-lg shadow-primary/25 group-hover:scale-110 transition-transform">
            M
          </div>
          <span className="text-lg font-black tracking-tighter text-foreground">
            MAILER<span className="opacity-30">OPS</span>
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setNotifOpen(!notifOpen)}
            className="w-10 h-10 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-all relative"
          >
            🔔
            <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-destructive border-2 border-background animate-pulse" />
          </button>
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center text-white text-xs font-black shadow-md shadow-primary/20">
            {currentUser?.email?.substring(0, 1).toUpperCase() || 'U'}
          </div>
        </div>
      </header>

      {/* ─── Notification Dropdown ─── */}
      {notifOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setNotifOpen(false)} />
          <div className="fixed top-[60px] right-4 z-50 w-72 bg-background border border-border rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-top-2 duration-200">
            <div className="px-4 py-3 border-b border-border bg-muted/30">
              <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">Notifications</span>
            </div>
            <div className="p-6 text-center">
              <div className="text-3xl mb-2 opacity-30">🔔</div>
              <p className="text-xs text-muted-foreground font-medium">Aucune notification pour l'instant</p>
            </div>
          </div>
        </>
      )}

      {/* ─── Main Content ─── */}
      <main className="flex-1 overflow-auto px-4 py-5 bg-accent/10">
        {children}
      </main>

      {/* ─── Bottom Tab Bar ─── */}
      <nav className="mobile-tabbar fixed bottom-0 left-0 right-0 z-30 bg-background/95 backdrop-blur-xl border-t border-border/50 safe-area-bottom">
        <div className="flex items-center justify-around h-[68px] max-w-lg mx-auto px-2">
          {TABS.map(tab => {
            const active = isActive(tab.to);
            return (
              <Link
                key={tab.to}
                to={tab.to}
                className={`mobile-tab flex flex-col items-center justify-center gap-0.5 py-1 px-3 rounded-2xl transition-all duration-200 min-w-[60px] ${active
                    ? 'text-primary scale-105'
                    : 'text-muted-foreground hover:text-foreground'
                  }`}
              >
                <span className={`text-xl transition-transform duration-200 ${active ? 'scale-110' : 'grayscale opacity-60'}`}>
                  {active ? tab.activeIcon : tab.icon}
                </span>
                <span className={`text-[9px] font-black uppercase tracking-wider leading-none mt-0.5 ${active ? 'text-primary' : 'text-muted-foreground opacity-70'
                  }`}>
                  {tab.label}
                </span>
                {active && (
                  <div className="w-4 h-1 rounded-full bg-primary mt-0.5 animate-in zoom-in duration-200" />
                )}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
