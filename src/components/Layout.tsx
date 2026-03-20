import { type ReactNode, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAppContext } from '../App';
import InsightsBox from './InsightsBox';
import CommandPalette from './CommandPalette';

const NAV = [
  { to: '/',            label: 'Home',        icon: '⬡' },
  { to: '/deliveries',  label: 'Deliveries',  icon: '📬' },
  { to: '/servers',     label: 'Servers',     icon: '🖥' },
  { to: '/postmaster',  label: 'Postmaster',  icon: '📡' },
  { to: '/history',     label: 'Analytics',   icon: '📈' },
  { to: '/settings',    label: 'Settings',    icon: '⚙' },
];

// /dashboard still exists but is not in main nav
// accessible via Home quick-link for legacy seed task tracking

export default function Layout({ children }: { children: ReactNode }) {
  const { currentUser, logout } = useAppContext();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-[#0d0f11] flex flex-col">
      {/* HEADER */}
      <header className="sticky top-0 z-50 bg-[#131619] border-b border-[#252b32] flex items-center justify-between px-4 h-12 shrink-0">
        <div className="flex items-center gap-2">
          <button className="md:hidden text-[#5a6478] hover:text-[#4df0a0] mr-1"
            onClick={() => setMobileOpen(v => !v)}>☰</button>
          <span className="text-[#4df0a0] text-lg">⬡</span>
          <span className="font-['Syne',sans-serif] font-extrabold text-[#e2e8f0] tracking-wide text-sm">
            MAILER<span className="text-[#4df0a0]">OPS</span>
          </span>
          <span className="hidden sm:block text-[10px] text-[#5a6478] bg-[#1a1e22] border border-[#252b32] rounded px-2 py-0.5 ml-2 font-mono">
            {new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {currentUser && (
            <>
              <span className="hidden sm:block text-[11px] text-[#5a6478] font-mono">{currentUser.email}</span>
              <button onClick={handleLogout}
                className="text-[11px] text-[#5a6478] hover:text-[#f04d4d] border border-[#252b32] rounded px-2 py-1 font-mono transition-colors">
                Sign out
              </button>
            </>
          )}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* SIDEBAR */}
        <nav className={`fixed md:static inset-y-0 left-0 z-40 w-48 bg-[#0d0f11] border-r border-[#252b32]
          flex flex-col pt-4 pb-6 transition-transform duration-200
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
          <div className="flex-1 px-2 space-y-0.5 mt-10 md:mt-0">
            {NAV.map(n => {
              const active = n.to === '/'
                ? location.pathname === '/'
                : location.pathname.startsWith(n.to);
              return (
                <Link key={n.to} to={n.to}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2 rounded-md text-[13px] font-mono transition-all
                    ${active
                      ? 'bg-[#0d2e1e] text-[#4df0a0] border border-[#1f5c3e]'
                      : 'text-[#5a6478] hover:text-[#9aa5b4] hover:bg-[#131619]'
                    }`}>
                  <span className="text-base w-5 text-center">{n.icon}</span>
                  {n.label}
                </Link>
              );
            })}

            {/* divider + legacy link */}
            <div className="pt-3 mt-2 border-t border-[#252b32]">
              <Link to="/dashboard"
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-[13px] font-mono transition-all
                  ${location.pathname === '/dashboard'
                    ? 'bg-[#0d2e1e] text-[#4df0a0] border border-[#1f5c3e]'
                    : 'text-[#5a6478] hover:text-[#9aa5b4] hover:bg-[#131619]'
                  }`}>
                <span className="text-base w-5 text-center">◈</span>
                Seed Tasks
              </Link>
            </div>
          </div>
        </nav>

        {mobileOpen && (
          <div className="fixed inset-0 z-30 bg-black/50 md:hidden"
            onClick={() => setMobileOpen(false)} />
        )}

        {/* MAIN */}
        <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
      </div>

      <InsightsBox />
      <CommandPalette />
    </div>
  );
}