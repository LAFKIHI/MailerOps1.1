import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import AppLogo from './ui/AppLogo';
import {
  Server,
  Globe,
  Activity,
  Thermometer,
  BarChart3,
  Mail,
  Users,
  Settings,
  Beaker,
  ChevronLeft,
  ChevronRight,
  Bell,
  Database,
  Zap,
  LayoutDashboard,
  ShieldAlert,
  Calendar,
  Layers,
  LogOut,
  Send,
} from 'lucide-react';
import { useAppContext } from '../App';

const mainLinks = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/' },
  { icon: ShieldAlert, label: 'Nodes Cluster', href: '/servers' },
  { icon: Send, label: 'Mass Deliveries', href: '/bulk-domains' },
  { icon: BarChart3, label: 'Domain Health', href: '/domains' },
  { icon: Calendar, label: 'Seed Tasks', href: '/seed-tasks' },
];

const navGroups = [
  {
    label: 'Servers+', // Changed label
    items: [
      { label: 'Server Management', icon: Server, href: '/servers', badge: null },
      { label: 'Deliveries', icon: Send, href: '/deliveries', badge: null }, // Modified item
      { label: 'Domain Health', icon: Globe, href: '/domains', badge: null },
    ],
  },
  {
    label: 'Operations',
    items: [
      { label: 'Servers', icon: Thermometer, href: '/servers', badge: null }, // Modified item
      { label: 'Bulk Domains', icon: Layers, href: '/bulk-domains', badge: null }, // New item
      { label: 'Test Seeds', icon: Beaker, href: '/test-seed', badge: null },
    ],
  },
  {
    label: 'Data',
    items: [
      { label: 'Postmaster Raw', icon: Database, href: '/postmaster', badge: null },
      { label: 'Reputation', icon: Zap, href: '/analytics', badge: null },
    ],
  },
  {
    label: 'Account',
    items: [
      { label: 'Accounts', icon: Users, href: '/settings', badge: null },
      { label: 'Settings', icon: Settings, href: '/settings', badge: null },
    ],
  },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const { currentUser, logout, showToast } = useAppContext();
  const pathname = location.pathname;

  return (
    <aside
      className="flex flex-col h-screen sticky top-0 shrink-0 transition-all duration-300 ease-in-out z-40"
      style={{
        width: collapsed ? 64 : 240,
        background: 'hsl(var(--surface))',
        borderRight: '1px solid hsl(var(--border))',
      }}
    >
      {/* Logo */}
      <div className="flex items-center h-16 px-3 shrink-0" style={{ borderBottom: '1px solid hsl(var(--border))' }}>
        <div className="flex items-center gap-2 overflow-hidden">
          <AppLogo size={32} />
          {!collapsed && (
            <span className="font-semibold text-base whitespace-nowrap" style={{ color: 'hsl(var(--foreground))' }}>
              MailerOps
            </span>
          )}
        </div>
      </div>
      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
        {navGroups.map((group) => (
          <div key={group.label}>
            {!collapsed && (
              <p className="px-2 mb-1 text-xs font-semibold uppercase tracking-widest" style={{ color: 'hsl(var(--muted))' }}>
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.label}
                    to={item.href}
                    className={`nav-item ${isActive ? 'active' : ''}`}
                    title={collapsed ? item.label : undefined}
                  >
                    {typeof Icon === 'string' ? null : <Icon size={18} className="shrink-0" />}
                    {!collapsed && (
                      <>
                        <span className="flex-1 truncate">{item.label}</span>
                        {item.badge !== null && (
                          <span
                            className="text-xs font-semibold px-1.5 py-0.5 rounded-full"
                            style={{
                              background: 'hsl(var(--primary-muted))',
                              color: 'hsl(var(--primary))',
                            }}
                          >
                            {item.badge}
                          </span>
                        )}
                      </>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      {/* Bottom */}
      <div className="shrink-0 px-2 pb-3 space-y-1" style={{ borderTop: '1px solid hsl(var(--border))', paddingTop: 12 }}>
        <button 
          onClick={() => showToast('Opening notifications...')}
          className="nav-item w-full text-left" 
          title={collapsed ? 'Notifications' : undefined}
        >
          <Bell size={18} className="shrink-0" />
          {!collapsed && <span className="flex-1">Notifications</span>}
        </button>
        <button onClick={logout} className="nav-item w-full text-left" title={collapsed ? 'Sign Out' : undefined}>
          <LogOut size={18} className="shrink-0" />
          {!collapsed && <span className="flex-1">Sign Out</span>}
        </button>
        {!collapsed && currentUser && (
          <div
            onClick={() => showToast(`User: ${currentUser.email}`)}
            className="mx-1 mt-2 p-2 rounded-lg flex items-center gap-2 cursor-pointer hover:bg-white/5 transition-colors"
            style={{ background: 'hsl(var(--surface-elevated))' }}
          >
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
              style={{ background: 'hsl(var(--primary))', color: 'hsl(222 25% 8%)' }}
            >
              {currentUser.email?.substring(0, 2).toUpperCase() || 'U'}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-semibold truncate" style={{ color: 'hsl(var(--foreground))' }}>
                {currentUser.email?.split('@')[0]}
              </p>
              <p className="text-xs truncate" style={{ color: 'hsl(var(--muted))' }}>
                {currentUser.email}
              </p>
            </div>
          </div>
        )}
      </div>
      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-20 w-6 h-6 rounded-full flex items-center justify-center transition-all duration-150 hover:scale-110 z-10"
        style={{
          background: 'hsl(var(--surface-elevated))',
          border: '1px solid hsl(var(--border))',
          color: 'hsl(var(--muted))',
        }}
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>
    </aside>
  );
}
