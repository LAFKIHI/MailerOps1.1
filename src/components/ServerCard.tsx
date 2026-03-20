import { useState } from 'react';
import type { Server } from '../lib/types';
import { getServerRdp } from '../lib/server';
import { useAppContext } from '../App';
import { FEATURES } from '../lib/features';

type ServerStats = {
  domains: number;
  ips: number;
  inbox: number;
  spam: number;
  blocked: number;
};

export default function ServerCard({
  server,
  stats,
  selected,
  onToggle,
  onOpen,
  onEdit,
  onDelete,
}: {
  server: Server;
  stats: ServerStats;
  selected: boolean;
  onToggle: () => void;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [showIps, setShowIps] = useState(false);
  const { domains, ips, markIpReady, markIpBurned } = useAppContext();
  const serverIps = ips.filter(ip => domains.some(d => d.serverId === server.id && d.id === ip.domainId));

  const total = stats.inbox + stats.spam + stats.blocked || 1;
  const rdp = getServerRdp(server);

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onToggle();
        }
      }}
      className={`relative overflow-hidden rounded-2xl border p-4 transition-all cursor-pointer
        ${selected
          ? 'border-[#4d8ff0] bg-[#121a26] shadow-[0_12px_30px_rgba(77,143,240,0.18)]'
          : 'border-[#252b32] bg-[#131619] hover:border-[#4df0a0] hover:-translate-y-0.5 hover:shadow-[0_12px_26px_rgba(77,240,160,0.12)]'}`}
    >
      <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-[#4d8ff0] via-[#72d4ff] to-[#4df0a0]" />

      <div className="flex items-start justify-between gap-3">
        <label
          className="flex items-center gap-3"
          onClick={event => event.stopPropagation()}
        >
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggle}
            className="mt-0.5 h-4 w-4 accent-[#4df0a0] cursor-pointer"
          />
          <div>
            <div className="font-['Syne',sans-serif] text-sm font-bold text-[#e2e8f0]">{server.name}</div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] font-mono">
              <span className="rounded-full border border-[#1a3a6e] bg-[#0d1e3e] px-2 py-0.5 text-[#4d8ff0]">
                {rdp ? `RDP ${rdp}` : 'No RDP'}
              </span>
              <span className="rounded-full border border-[#2f4c36] bg-[#102118] px-2 py-0.5 text-[#4df0a0]">
                {server.runtimeStatus === 'running' ? '🟢 Running' : server.runtimeStatus === 'stopped' ? '🔴 Stopped' : server.runtimeStatus}
              </span>
              <span className="rounded-full border border-[#3a3230] bg-[#1c1716] px-2 py-0.5 text-[#d7c2b4]">
                {server.status === 'active' ? '🟢 Active' : server.status === 'paused' ? '⏸ Paused' : server.status === 'banned' ? '🔴 Banned' : server.status}
              </span>
            </div>
          </div>
        </label>

        <div
          className="flex items-center gap-1"
          onClick={event => event.stopPropagation()}
        >
          <button
            onClick={onOpen}
            className="rounded-md border border-[#252b32] bg-[#1a1e22] px-2 py-1 text-[11px] font-mono text-[#9aa5b4] transition-all hover:border-[#4d8ff0] hover:text-[#4d8ff0]"
          >
            Open
          </button>
          <button
            onClick={onEdit}
            className="rounded-md border border-[#252b32] bg-[#1a1e22] px-2 py-1 text-[11px] font-mono text-[#9aa5b4] transition-all hover:border-[#4df0a0] hover:text-[#4df0a0]"
          >
            Edit
          </button>
          <button
            onClick={onDelete}
            className="rounded-md border border-[#252b32] bg-[#1a1e22] px-2 py-1 text-[11px] font-mono text-[#9aa5b4] transition-all hover:border-[#f04d4d] hover:text-[#f04d4d]"
          >
            Delete
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-mono">
        <span className="rounded-full bg-[#0d1e3e] px-2 py-1 text-[#4d8ff0]">{stats.domains} domains</span>
        <span className="rounded-full bg-[#0d2e1e] px-2 py-1 text-[#4df0a0]">{stats.ips} IPs</span>
        <span className="rounded-full bg-[#171c23] px-2 py-1 text-[#d8e0ea]">{server.sendPerDay ?? 0}/day</span>
      </div>

      <div className="mt-4 flex overflow-hidden rounded-full bg-[#0d0f11]">
        <div className="h-2 bg-[#4df0a0]" style={{ width: `${(stats.inbox / total) * 100}%` }} />
        <div className="h-2 bg-[#f09a4d]" style={{ width: `${(stats.spam / total) * 100}%` }} />
        <div className="h-2 bg-[#f04d4d]" style={{ width: `${(stats.blocked / total) * 100}%` }} />
      </div>

      <div className="mt-3 flex flex-wrap gap-3 text-[10px] font-mono">
        <span className="text-[#4df0a0]">{stats.inbox} inbox</span>
        <span className="text-[#f09a4d]">{stats.spam} spam</span>
        <span className="text-[#f04d4d]">{stats.blocked} blocked</span>
      </div>

      {server.tags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {server.tags.map(tag => (
            <span
              key={tag}
              className="rounded-full border border-[#30384a] bg-[#141b2a] px-2 py-0.5 text-[10px] font-mono text-[#8ab3ff]"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* --- BEGIN SHADOW UI INJECTION --- */}
      {FEATURES.IP_TRACKING && serverIps.length > 0 && (
        <div className="mt-4 border-t border-[#252b32] pt-3" onClick={e => e.stopPropagation()}>
          <button 
            onClick={(e) => { e.stopPropagation(); setShowIps(!showIps); }}
            className="flex items-center gap-2 text-xs font-mono text-[#9aa5b4] hover:text-[#4d8ff0] transition-colors"
          >
            {showIps ? '▼' : '▶'} IPs tracking ({serverIps.length})
          </button>
          
          {showIps && (
            <div className="mt-3 flex flex-col gap-2">
              {serverIps.map(ip => {
                const isRisky = FEATURES.SUGGESTIONS && (ip.health_score ?? 100) < 50;
                return (
                  <div key={ip.id} className="flex flex-wrap items-center justify-between gap-2 p-2 rounded bg-[#0d0f11] border border-[#252b32]">
                    <div className="flex items-center gap-2 text-[11px] font-mono text-[#d8e0ea]">
                      <span className="text-[#4df0a0]">{ip.ip}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[9px] ${
                        ip.status === 'scaled' ? 'bg-[#0d2e1e] text-[#4df0a0]' 
                        : ip.status === 'burned' ? 'bg-[#2e0d0d] text-[#f04d4d]' 
                        : 'bg-[#1a1e22] text-[#cbd5e1]'
                      }`}>
                        {ip.status === 'scaled' ? '🟢 Scaled' : ip.status === 'burned' ? '🔴 Burned' : '⚪ Fresh'}
                      </span>
                      {isRisky && <span className="text-[#f04d4d] animate-pulse">⚠ risky</span>}
                      {ip.total_sent ? <span className="text-[#5a6478]">sent: {ip.total_sent}</span> : null}
                    </div>
                    <div className="flex gap-1">
                      {ip.status !== 'scaled' && (
                        <button onClick={(e) => { e.stopPropagation(); markIpReady(ip.id); }} className="px-2 py-0.5 rounded text-[9px] font-mono border border-[#4df0a0] text-[#4df0a0] hover:bg-[#0d2e1e] transition-colors">Mark Ready</button>
                      )}
                      {ip.status !== 'burned' && (
                        <button onClick={(e) => { e.stopPropagation(); markIpBurned(ip.id); }} className="px-2 py-0.5 rounded text-[9px] font-mono border border-[#f04d4d] text-[#f04d4d] hover:bg-[#2e0d0d] transition-colors">Burned</button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
      {/* --- END SHADOW UI INJECTION --- */}
    </article>
  );
}
