import React, { type ReactNode } from 'react';
import Sidebar from './Sidebar';
import { Bell, Search, Sun, Moon } from 'lucide-react';
import { useAppContext } from '../App';
import { useState, useEffect } from 'react';
import HeaderNavigationControls from './HeaderNavigationControls';

export default function Layout({ children }: { children: ReactNode }) {
  const { currentUser, showToast } = useAppContext();
  const [dark, setDark] = useState(() => localStorage.getItem('theme') === 'dark');
  const [searchFocused, setSearchFocused] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);

  const username = currentUser?.email?.split('@')[0] ?? 'User';
  const initials = username.slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen flex bg-background text-foreground transition-colors duration-300">
      {/* Sidebar Component */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        
        {/* Header */}
        <header 
          className="h-16 flex items-center justify-between px-6 shrink-0 z-30"
          style={{ 
            background: 'hsl(var(--surface))', 
            borderBottom: '1px solid hsl(var(--border))' 
          }}
        >
          {/* Left: Search bar */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <HeaderNavigationControls />
            <div 
              className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all duration-200 border min-w-0 ${
                searchFocused ? 'w-80 border-primary ring-2 ring-primary/10' : 'w-64 border-border'
              }`}
              style={{ background: 'hsl(var(--surface-elevated))' }}
            >
              <Search size={14} className="text-muted" />
              <input
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                placeholder="Search or type command…"
                className="bg-transparent outline-none text-sm flex-1 min-w-0 text-foreground"
              />
              <kbd className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-surface border border-border text-muted">⌘K</kbd>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-3">
            {/* Date */}
            <span className="hidden md:block text-xs px-3 py-1.5 rounded-lg font-medium bg-surface-elevated border border-border text-foreground-muted">
              {new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
            </span>

            {/* Theme toggle */}
            <button 
              onClick={() => setDark(!dark)}
              className="w-10 h-10 rounded-xl flex items-center justify-center transition-all hover:scale-105 bg-surface-elevated border border-border text-foreground-muted hover:text-foreground"
            >
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            {/* Notification bell */}
            <div className="relative">
              <button 
                onClick={() => setNotifOpen(!notifOpen)}
                className="relative w-10 h-10 rounded-xl flex items-center justify-center transition-all hover:scale-105 bg-surface-elevated border border-border text-foreground-muted hover:text-foreground"
              >
                <Bell size={18} />
                <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-danger border-2 border-surface animate-pulse" />
              </button>

              {notifOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setNotifOpen(false)} />
                  <div className="absolute top-12 right-0 z-50 w-80 bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="px-4 py-3 border-b border-border bg-surface-elevated/50 flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-widest text-muted">Notifications</span>
                      <span className="text-[10px] text-primary font-bold px-2 py-0.5 rounded-full bg-primary/10">1 New</span>
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      <div className="p-4 flex gap-3 hover:bg-surface-elevated transition-colors cursor-pointer border-b border-border/50">
                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                          <Bell size={14} className="text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">System Initialized</p>
                          <p className="text-xs text-muted mt-0.5 text-balance">MailerOps is ready for scaling operations.</p>
                          <p className="text-[10px] text-muted mt-2">Just now</p>
                        </div>
                      </div>
                      <div className="p-6 text-center bg-surface-elevated/10">
                        <p className="text-xs text-muted font-medium">No other notifications</p>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* User Avatar */}
            <div 
              onClick={() => showToast(`Signed in as ${currentUser?.email || 'User'}`)}
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-xs font-bold cursor-pointer hover:opacity-85 transition-opacity bg-primary shadow-lg shadow-primary/20"
            >
              {initials}
            </div>
          </div>
        </header>

        {/* Dynamic Page Content */}
        <main className="flex-1 overflow-y-auto p-6 scroll-smooth">
          <div className="max-w-7xl mx-auto animate-fade-in">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
