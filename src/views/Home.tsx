import { useNavigate } from 'react-router-dom';

import { useAppContext } from '../App';
import Badge from '../components/Badge';
import StatCard from '../components/StatCard';
import { todayStr } from '../lib/constants';

export default function Home() {
  const { tasks, servers, domains, currentUser, isReady } = useAppContext();
  const navigate = useNavigate();

  if (!isReady) return <Spinner />;

  const today = todayStr();
  const todayTasks = tasks.filter(t => t.date === today && !t.archived);
  const totalSeeds = todayTasks.reduce((s, t) => s + t.seedCount, 0);
  const deliveries = new Set(todayTasks.map(t => t.deliveryName)).size;
  const tasksDone = todayTasks.filter(t => t.status === 'Done').length;
  const tasksLeft = todayTasks.filter(t => t.status !== 'Done').length;

  const activeDomains = domains.filter(d => d.status === 'inbox').length;
  const blockedDomains = domains.filter(d => d.status === 'blocked').length;

  // recent activity: last 6 items across tasks + servers
  const activity = [
    ...tasks.slice().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5)
      .map(t => ({ type: 'Seed' as const, name: t.deliveryName, info: `Server ${t.serverId} · ${t.seedCount} seeds`, status: t.status, time: t.createdAt })),
    ...servers.slice().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 3)
      .map(s => ({ type: 'Server' as const, name: s.name, info: 'Infrastructure server', status: 'Active', time: s.createdAt })),
  ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 8);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Welcome Hero */}
      <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-primary/10 via-background to-accent/20 border border-primary/10 p-8 md:p-12 shadow-2xl shadow-primary/5">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <span className="px-3 py-1 bg-primary text-white text-[10px] font-bold uppercase tracking-[0.2em] rounded-full">System Live</span>
              <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold text-foreground tracking-tight leading-tight mb-2">
              Welcome back, <span className="text-primary">{currentUser?.email ? currentUser.email.split('@')[0] : 'Admin'}</span>
            </h1>
            <p className="text-muted-foreground text-lg font-medium max-w-xl">
              Cluster operations are running smoothly. You have <span className="text-foreground font-bold">{tasksLeft} active tasks</span> requiring attention today.
            </p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => navigate('/dashboard')} className="kt-btn kt-btn-primary px-8 py-3 rounded-2xl shadow-xl shadow-primary/20 hover:scale-105 transition-all font-bold">
              Launch Task
            </button>
            <button onClick={() => navigate('/servers')} className="kt-btn kt-btn-light px-8 py-3 rounded-2xl hover:scale-105 transition-all font-bold">
              Manage Cluster
            </button>
          </div>
        </div>
        {/* Decorative elements */}
        <div className="absolute -right-20 -top-20 w-80 h-80 bg-primary/10 rounded-full blur-[100px]" />
        <div className="absolute -left-20 -bottom-20 w-80 h-80 bg-accent/20 rounded-full blur-[100px]" />
      </div>

      {/* Statistics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard label="Total Processed" value={totalSeeds.toLocaleString()} sub="Seeds Today" color="blue" />
        <StatCard label="Active Domains" value={activeDomains} sub="Inbox Status" color="green" />
        <StatCard label="Ongoing Tasks" value={deliveries} sub="Across Cluster" color="purple" />
        <StatCard label="System Alerts" value={blockedDomains} sub="Blocked Domains" color="red" />
      </div>

      {/* quick nav */}
      <section>
        <h2 className="section-title mb-3">Quick Actions</h2>
        <div className="flex flex-wrap gap-2">
          {[
            { label: '+ New Task', action: () => navigate('/dashboard'), accent: true },
            { label: 'View Seeds', action: () => navigate('/dashboard') },
            { label: 'Servers', action: () => navigate('/servers') },
            { label: 'Analytics', action: () => navigate('/history') },
          ].map(btn => (
            <button key={btn.label} onClick={btn.action}
              className={`text-sm font-mono px-4 py-2 rounded-md border transition-all
                ${btn.accent
                  ? 'bg-[#4df0a0] text-black font-bold border-[#4df0a0] hover:opacity-85'
                  : 'bg-[#1a1e22] text-[#9aa5b4] border-[#252b32] hover:border-[#4df0a0] hover:text-[#4df0a0]'
                }`}>
              {btn.label}
            </button>
          ))}
        </div>
      </section>

      {/* Recent Activity Table */}
      {activity.length > 0 && (
        <div className="kt-card overflow-hidden border-border/50 shadow-xl shadow-black/5">
          <div className="px-8 py-6 border-b border-border flex items-center justify-between bg-muted/20">
            <div>
              <h2 className="text-xl font-bold text-foreground">Recent Activity</h2>
              <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest mt-1">Live Operation Log</p>
            </div>
            <button className="kt-btn kt-btn-xs kt-btn-light font-bold" onClick={() => navigate('/history')}>
              View Full Analytics
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="kt-table w-full">
              <thead>
                <tr>
                  <th className="px-8 py-4 text-left text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground opacity-60">Status</th>
                  <th className="px-8 py-4 text-left text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground opacity-60">Resource</th>
                  <th className="px-8 py-4 text-left text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground opacity-60 hidden md:table-cell">Operation Details</th>
                  <th className="px-8 py-4 text-right text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground opacity-60">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {activity.map((a, i) => (
                  <tr key={i}
                    onClick={() => a.type === 'Seed' ? navigate('/dashboard') : navigate('/servers')}
                    className="hover:bg-primary/[0.02] cursor-pointer transition-all group"
                  >
                    <td className="px-8 py-5">
                      <span className={`kt-badge px-3 py-1 text-[10px] font-bold uppercase tracking-wider
                        ${a.status === 'Done' || a.status === 'Active' ? 'kt-badge-success' : 'kt-badge-warning'}`}>
                        {a.status}
                      </span>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">{a.name}</span>
                        <span className="text-[10px] font-bold text-muted-foreground uppercase mt-1 tracking-widest opacity-60">{a.type}</span>
                      </div>
                    </td>
                    <td className="px-8 py-5 hidden md:table-cell">
                      <span className="text-xs text-muted-foreground font-medium">{a.info}</span>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <span className="text-[11px] font-bold text-muted-foreground font-mono bg-muted px-2 py-1 rounded-lg">
                        {new Date(a.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex items-center justify-center h-64">
      <span className="text-[#5a6478] text-sm font-mono animate-pulse">Loading data…</span>
    </div>
  );
}
