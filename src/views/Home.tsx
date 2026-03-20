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
  const totalSeeds    = todayTasks.reduce((s, t) => s + t.seedCount, 0);
  const deliveries    = new Set(todayTasks.map(t => t.deliveryName)).size;
  const tasksDone     = todayTasks.filter(t => t.status === 'Done').length;
  const tasksLeft     = todayTasks.filter(t => t.status !== 'Done').length;

  const activeDomains  = domains.filter(d => d.status === 'inbox').length;
  const blockedDomains = domains.filter(d => d.status === 'blocked').length;

  // recent activity: last 6 items across tasks + servers
  const activity = [
    ...tasks.slice().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5)
      .map(t => ({ type: 'Seed' as const, name: t.deliveryName, info: `Server ${t.serverId} · ${t.seedCount} seeds`, status: t.status, time: t.createdAt })),
    ...servers.slice().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 3)
      .map(s => ({ type: 'Server' as const, name: s.name, info: 'Infrastructure server', status: 'Active', time: s.createdAt })),
  ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 8);

  return (
    <div className="space-y-6">
      {/* welcome */}
      <div>
        <h1 className="font-['Syne',sans-serif] font-bold text-[#e2e8f0] text-lg">
          Welcome back{currentUser?.email ? `, ${currentUser.email.split('@')[0]}` : ''}
        </h1>
        <p className="text-[#5a6478] text-sm font-mono mt-0.5">Here's what's happening today.</p>
      </div>

      {/* seed stats */}
      <section>
        <h2 className="section-title mb-3">Seed Operations — Today</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Seeds Processed" value={totalSeeds.toLocaleString()} sub="today" />
          <StatCard label="Deliveries"       value={deliveries}                  sub="active today"  color="blue" />
          <StatCard label="Tasks Done"        value={tasksDone}                   sub="completed" />
          <StatCard label="Remaining"         value={tasksLeft}                   sub="in progress"   color="orange" />
        </div>
      </section>

      {/* server stats */}
      <section>
        <h2 className="section-title mb-3">Infrastructure</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Total Servers"    value={servers.length}      sub="configured" color="blue" />
          <StatCard label="Total Domains"    value={domains.length}      sub="across all servers" />
          <StatCard label="Active (Inbox)"   value={activeDomains}       sub="domains" />
          <StatCard label="Blocked"          value={blockedDomains}      sub="domains"  color="red" />
        </div>
      </section>

      {/* quick nav */}
      <section>
        <h2 className="section-title mb-3">Quick Actions</h2>
        <div className="flex flex-wrap gap-2">
          {[
            { label: '+ New Task',   action: () => navigate('/dashboard'), accent: true },
            { label: 'View Seeds',   action: () => navigate('/dashboard') },
            { label: 'Servers',      action: () => navigate('/servers') },
            { label: 'Analytics',   action: () => navigate('/history') },
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

      {/* recent activity */}
      {activity.length > 0 && (
        <section>
          <h2 className="section-title mb-3">Recent Activity</h2>
          <div className="bg-[#131619] border border-[#252b32] rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#252b32]">
                  {['Type', 'Name', 'Info', 'Status', 'Time'].map((h, i) => (
                    <th key={h} className={`text-left px-4 py-3 text-[10px] uppercase tracking-widest text-[#5a6478] font-medium ${i === 2 ? 'hidden sm:table-cell' : ''}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activity.map((a, i) => (
                  <tr key={i}
                    onClick={() => a.type === 'Seed' ? navigate('/dashboard') : navigate('/servers')}
                    className="border-b border-[#252b32] last:border-0 hover:bg-[#1a1e22] cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      <Badge label={a.type === 'Seed' ? 'In Progress' : 'Done'} />
                    </td>
                    <td className="px-4 py-3 font-medium text-[#e2e8f0]">{a.name}</td>
                    <td className="px-4 py-3 text-[#5a6478] text-xs hidden sm:table-cell">{a.info}</td>
                    <td className="px-4 py-3"><Badge label={a.status} /></td>
                    <td className="px-4 py-3 text-[#5a6478] text-xs font-mono">
                      {new Date(a.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
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
