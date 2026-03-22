import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../App';
import BulkActionPanel from '../components/BulkActionPanel';
import Modal, { Field, Input, ModalFooter } from '../components/Modal';
import ServerCard from '../components/ServerCard';
import { getServerRdp } from '../lib/server';
import { useConfirm } from '../hooks/useConfirm';
import { todayStr, fmtDate } from '../lib/constants';
import Drawer, { DField, DInput, DFooter } from '../components/Drawer';
import type { Domain } from '../lib/types';
import { domainHealthScore, healthColor, healthLabel } from '../lib/types';
import { parseIngestionText } from '../lib/ingestion';

interface ParsedRow {
  domain: string;
  ip: string;
  serverName: string;
  error?: string;
}

function parseImportText(text: string): ParsedRow[] {
  const all = parseIngestionText(text);
  return all.map(row => ({
    domain: row.domain,
    ip: row.ip,
    serverName: row.serverHint || '',
    error: row.error
  }));
}

export default function Servers() {
  const {
    servers,
    domains,
    ips,
    showToast,
    createServer,
    deleteServer,
    updateServer,
    importDomains,
    currentUser,
    refreshData,
    selectedServers,
    setSelectedServers,
    clearSelectedServers,
    toggleSelectedServer,
    addWarmup,
    reputation,
  } = useAppContext();
  const navigate = useNavigate();
  const { confirm } = useConfirm();

  const [addOpen, setAddOpen] = useState(false);
  const [editSrv, setEditSrv] = useState<{ id: string; name: string; rdp: string; tags: string[] } | null>(null);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [name, setName] = useState('');
  const [rdp, setRdp] = useState('');
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('');
  const [bulkText, setBulkText] = useState('');
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkPreview, setBulkPreview] = useState<ParsedRow[]>([]);
  const [defaultSrv, setDefaultSrv] = useState('');
  const [newSrvName, setNewSrvName] = useState('');
  const [bulkRdp, setBulkRdp] = useState('');
  const [bulkDailyLimit, setBulkDailyLimit] = useState('');
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [bulkWarmup, setBulkWarmup] = useState('');
  const [bulkWarmupDate, setBulkWarmupDate] = useState(todayStr());
  const [bulkTag, setBulkTag] = useState('');
  const [bulkRemoveTag, setBulkRemoveTag] = useState('');

  const [repPanel, setRepPanel] = useState<Domain | null>(null);
  
  // Single IP warmup drawer state
  const [warmupDrawerOpen, setWarmupDrawerOpen] = useState(false);
  const [warmupIpId, setWarmupIpId] = useState('');
  const [warmupSent, setWarmupSent] = useState('');
  const [warmupDate, setWarmupDate] = useState(todayStr());
  const [warmupSaving, setWarmupSaving] = useState(false);

  const handleBulkWarmup = async () => {
    if (!warmupSent || !warmupIpId) return;
    setWarmupSaving(true);
    try {
      const sentNum = Number(warmupSent);
      await addWarmup(warmupIpId, sentNum, warmupDate);
      showToast(`Logged ${sentNum.toLocaleString()} sent for IP ✓`);
      setWarmupDrawerOpen(false);
      await refreshData();
    } catch { showToast('Error logging warmup', true); }
    setWarmupSaving(false);
  };

  const activeServers = useMemo(() => (
    servers.filter(server => !server.archived && (
      !filter
      || server.name.toLowerCase().includes(filter.toLowerCase())
      || getServerRdp(server).toLowerCase().includes(filter.toLowerCase())
      || server.tags.some(tag => tag.toLowerCase().includes(filter.toLowerCase()))
    ))
  ), [filter, servers]);

  const statsForServer = (serverId: string) => {
    const serverDomains = domains.filter(domain => domain.serverId === serverId && !domain.archived);
    const domainIds = serverDomains.map(domain => domain.id);

    return {
      domains: serverDomains.length,
      ips: ips.filter(ip => domainIds.includes(ip.domainId)).length,
      inbox: serverDomains.filter(domain => domain.status === 'inbox').length,
      spam: serverDomains.filter(domain => domain.status === 'spam').length,
      blocked: serverDomains.filter(domain => domain.status === 'blocked').length,
    };
  };

  const groupedServers = useMemo(() => {
    const map: Record<string, typeof activeServers> = {};

    activeServers.forEach(server => {
      const key = getServerRdp(server) || 'No RDP';
      map[key] = map[key] ?? [];
      map[key].push(server);
    });

    return Object.entries(map)
      .map(([groupRdp, groupServers]) => ({
        rdp: groupRdp,
        servers: groupServers.sort((left, right) => left.name.localeCompare(right.name)),
        totals: groupServers.reduce((acc, server) => {
          const stats = statsForServer(server.id);
          acc.domains += stats.domains;
          acc.ips += stats.ips;
          acc.inbox += stats.inbox;
          acc.spam += stats.spam;
          acc.blocked += stats.blocked;
          return acc;
        }, { domains: 0, ips: 0, inbox: 0, spam: 0, blocked: 0 }),
      }))
      .sort((left, right) => left.rdp.localeCompare(right.rdp));
  }, [activeServers, domains, ips]);

  const validCount = bulkPreview.filter(row => !row.error).length;
  const errorCount = bulkPreview.filter(row => row.error).length;
  const rowsNeedServer = bulkPreview.filter(row => !row.error && !row.serverName).length;




  const handleAdd = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await createServer(name.trim(), rdp.trim());
      showToast('Server created');
      setAddOpen(false);
      setName('');
      setRdp('');
      await refreshData();
    } catch {
      showToast('Unable to create server', true);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async () => {
    if (!editSrv || !editSrv.name.trim()) return;
    setSaving(true);
    try {
      await updateServer(editSrv.id, {
        name: editSrv.name.trim(),
        rdp: editSrv.rdp.trim(),
      });
      showToast('Server updated');
      setEditSrv(null);
      await refreshData();
    } catch {
      showToast('Unable to update server', true);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (serverId: string, serverName: string) => {
    if (!await confirm({ title: 'Delete Server', message: `Delete server "${serverName}" and all linked domains, IPs and records?`, danger: true })) return;

    try {
      await deleteServer(serverId);
      showToast('Server deleted');
      await refreshData();
    } catch {
      showToast('Unable to delete server', true);
    }
  };

  const handleBulkSave = async () => {
    if (!currentUser || bulkPreview.length === 0) return;

    const validRows = bulkPreview.filter(row => !row.error);
    if (validRows.length === 0) {
      showToast('No valid rows to import', true);
      return;
    }

    setBulkSaving(true);

    try {
      const serverNameToRows: Record<string, ParsedRow[]> = {};

      validRows.forEach(row => {
        const resolvedName = (row.serverName || newSrvName || defaultSrv).trim();
        if (!resolvedName) return;

        const key = resolvedName.toLowerCase();
        serverNameToRows[key] = serverNameToRows[key] ?? [];
        serverNameToRows[key].push({ ...row, serverName: resolvedName });
      });

      const serverIdMap: Record<string, string> = {};

      for (const key of Object.keys(serverNameToRows)) {
        const resolvedName = serverNameToRows[key][0].serverName;
        const existing = servers.find(server => server.name.toLowerCase() === key && !server.archived);

        if (existing) {
          serverIdMap[key] = existing.id;
          continue;
        }

        try {
          const created = await createServer(resolvedName, '', []);
          if (created) serverIdMap[key] = created.id;
        } catch (e: any) {
          if (e.message.includes('already exists')) {
            const recheck = servers.find(server => server.name.toLowerCase() === key && !server.archived);
            if (recheck) serverIdMap[key] = recheck.id;
          } else {
            throw e;
          }
        }
      }

      for (const [key, rows] of Object.entries(serverNameToRows)) {
        const serverId = serverIdMap[key];
        if (!serverId) continue;

        const csv = rows.map(row => `${row.domain};${row.ip};${row.serverName}`).join('\n');
        await importDomains(serverId, csv);
      }

      await refreshData();
      showToast(`Imported ${validRows.length} domain${validRows.length > 1 ? 's' : ''}`);
      setBulkImportOpen(false);
      setBulkText('');
      setBulkPreview([]);
      setDefaultSrv('');
      setNewSrvName('');

      const firstKey = Object.keys(serverIdMap)[0];
      if (firstKey) navigate(`/servers/${serverIdMap[firstKey]}`);
    } catch (error: any) {
      showToast(error?.message || 'Import failed', true);
    } finally {
      setBulkSaving(false);
    }
  };

  const allVisibleSelected = activeServers.length > 0 && activeServers.every(server => selectedServers.includes(server.id));

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-muted/20 p-8 rounded-[2.5rem] border border-border/50 shadow-xl shadow-black/5">
        <div>
          <h1 className="text-3xl font-extrabold text-foreground tracking-tight">Infrastructure Cluster</h1>
          <p className="mt-1 text-sm font-bold text-muted-foreground uppercase tracking-[0.2em] opacity-60">
            {activeServers.length} Production Nodes Online
          </p>
        </div>

        <div className="flex flex-wrap gap-3 items-center">
          <div className="kt-input max-w-xs h-12 px-5 rounded-2xl flex items-center gap-3 bg-background border-border/50 focus-within:ring-4 focus-within:ring-primary/10 transition-all">
            <span className="opacity-40">🔍</span>
            <input
              value={filter}
              onChange={event => setFilter(event.target.value)}
              placeholder="Search nodes, RDP, tags..."
              className="bg-transparent outline-none text-sm font-bold placeholder:text-muted-foreground/40 w-full"
            />
          </div>

          <button
            onClick={() => {
              setBulkImportOpen(true);
              setBulkPreview([]);
              setBulkText('');
            }}
            className="kt-btn kt-btn-light h-12 px-6 rounded-2xl font-bold text-xs uppercase tracking-widest hover:scale-105 transition-all"
          >
            Bulk Ingestion
          </button>

          <button
            onClick={() => setAddOpen(true)}
            className="kt-btn kt-btn-primary h-12 px-8 rounded-2xl font-bold text-xs uppercase tracking-[0.2em] shadow-xl shadow-primary/20 hover:scale-105 transition-all"
          >
            Provision Node
          </button>
        </div>
      </header>

      <BulkActionPanel
        selectedIds={selectedServers}
        userId={currentUser?.uid}
        rdpValue={bulkRdp}
        onRdpChange={v => { setBulkRdp(v); setBulkError(null); }}
        dailyLimitValue={bulkDailyLimit}
        onDailyLimitChange={v => { setBulkDailyLimit(v); setBulkError(null); }}
        warmupValue={bulkWarmup}
        onWarmupChange={v => { setBulkWarmup(v); setBulkError(null); }}
        warmupDate={bulkWarmupDate}
        onWarmupDateChange={v => { setBulkWarmupDate(v); setBulkError(null); }}
        tagValue={bulkTag}
        onTagChange={v => { setBulkTag(v); setBulkError(null); }}
        removeTagValue={bulkRemoveTag}
        onRemoveTagChange={v => { setBulkRemoveTag(v); setBulkError(null); }}
        onSuccess={async (msg) => { await refreshData(); showToast(msg); }}
        onError={(msg) => { setBulkError(msg); showToast(msg, true); }}
        onClear={() => { 
          clearSelectedServers(); 
          setBulkRdp(''); 
          setBulkDailyLimit(''); 
          setBulkWarmup(''); 
          setBulkWarmupDate(todayStr()); 
          setBulkTag(''); 
          setBulkRemoveTag('');
          setBulkError(null); 
        }}
      />

      {activeServers.length === 0 ? (
        <div className="kt-card border-dashed p-16 text-center">
          <p className="text-sm text-muted-foreground">No servers match the current view.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {groupedServers.map(group => (
            <section key={group.rdp} className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3 bg-muted/50 px-5 py-2.5 rounded-2xl border border-border/50">
                  <input
                    type="checkbox"
                    checked={group.servers.length > 0 && group.servers.every(s => selectedServers.includes(s.id))}
                    onChange={() => {
                      const groupIds = group.servers.map(s => s.id);
                      const allSelected = groupIds.every(id => selectedServers.includes(id));
                      setSelectedServers(prev =>
                        allSelected
                          ? prev.filter(id => !groupIds.includes(id))
                          : [...new Set([...prev, ...groupIds])]
                      );
                    }}
                    className="w-4 h-4 rounded border-border text-primary cursor-pointer active:scale-95 transition-transform"
                  />
                  <div className="flex flex-col">
                    <span className="text-xs font-black uppercase tracking-widest text-foreground">
                      {group.rdp === 'No RDP' ? 'External Nodes' : `Cluster ${group.rdp}`}
                    </span>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase opacity-40">
                      {group.servers.length} Instances Registered
                    </span>
                  </div>
                </div>

                <div className="h-px flex-1 bg-gradient-to-r from-border/50 to-transparent" />

                <div className="flex items-center gap-6">
                   <div className="flex flex-col items-end">
                      <span className="text-xs font-black text-foreground">{group.totals.domains}</span>
                      <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest opacity-50">Domains</span>
                   </div>
                   <div className="flex flex-col items-end">
                      <span className="text-xs font-black text-success">{group.totals.ips}</span>
                      <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest opacity-50">IP Nodes</span>
                   </div>
                   <div className="flex flex-col items-end">
                      <span className="text-xs font-black text-primary">{group.totals.inbox}</span>
                      <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest opacity-50">Reliable</span>
                   </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {group.servers.map(server => (
                  <ServerCard
                    key={server.id}
                    server={server}
                    stats={statsForServer(server.id)}
                    selected={selectedServers.includes(server.id)}
                    onToggle={() => toggleSelectedServer(server.id)}
                    onOpen={() => navigate(`/servers/${server.id}`)}
                    onEdit={() => setEditSrv({
                      id: server.id,
                      name: server.name,
                      rdp: getServerRdp(server),
                      tags: server.tags,
                    })}
                    onDelete={() => handleDelete(server.id, server.name)}
                    onClickDomain={(domainId) => {
                      const d = domains.find(x => x.id === domainId);
                      if (d) setRepPanel(d);
                    }}
                    onWarmupIP={(ipId) => {
                      setWarmupIpId(ipId);
                      setWarmupSent('');
                      setWarmupDate(todayStr());
                      setWarmupDrawerOpen(true);
                    }}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {addOpen && (
        <Modal title="New Server" onClose={() => setAddOpen(false)} size="sm">
          <Field label="Server Name" required>
            <Input value={name} onChange={event => setName(event.target.value)} placeholder="e.g. VPS-NY-01" autoFocus />
          </Field>
          <Field label="RDP">
            <Input value={rdp} onChange={event => setRdp(event.target.value)} placeholder="e.g. 178" />
          </Field>
          <ModalFooter onCancel={() => setAddOpen(false)} onSave={handleAdd} saving={saving} />
        </Modal>
      )}

      {editSrv && (
        <Modal title="Edit Server" onClose={() => setEditSrv(null)} size="sm">
          <Field label="Server Name" required>
            <Input
              value={editSrv.name}
              onChange={event => setEditSrv(prev => prev ? { ...prev, name: event.target.value } : prev)}
              autoFocus
            />
          </Field>
          <Field label="RDP">
            <Input
              value={editSrv.rdp}
              onChange={event => setEditSrv(prev => prev ? { ...prev, rdp: event.target.value } : prev)}
            />
          </Field>
          <ModalFooter onCancel={() => setEditSrv(null)} onSave={handleEdit} saving={saving} />
        </Modal>
      )}

      {bulkImportOpen && (
        <Modal title="Mass Domain Ingestion" onClose={() => setBulkImportOpen(false)} size="lg">
          <div className="space-y-8 p-1">
            <div className="bg-primary/5 border border-primary/20 p-6 rounded-[2rem] flex items-start gap-5">
              <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center text-primary text-xl">💡</div>
              <div className="space-y-1">
                <h4 className="text-sm font-black text-primary uppercase tracking-widest">Protocol Instructions</h4>
                <p className="text-[11px] text-muted-foreground leading-relaxed max-w-lg">
                  Submit one entry per line using the sequence: <span className="text-foreground font-bold">domain.com; 1.2.3.4; ServerID</span>. Server identification is optional if a fallback target is specified below.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">CSV Data Payload</label>
              <textarea
                value={bulkText}
                onChange={event => {
                  setBulkText(event.target.value);
                  setBulkPreview([]);
                }}
                rows={10}
                placeholder={'example.com; 192.168.1.1; Node-01\ntest.org; 10.0.0.5'}
                className="w-full bg-muted/30 border border-border rounded-3xl p-6 text-sm font-mono text-foreground placeholder:text-muted-foreground/30 ring-inset focus:ring-4 focus:ring-primary/5 focus:border-primary/50 transition-all resize-none"
              />
              <div className="flex justify-start px-2">
                <button
                  onClick={() => setBulkPreview(parseImportText(bulkText))}
                  disabled={!bulkText.trim()}
                  className="kt-btn kt-btn-light h-10 px-6 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm disabled:opacity-40"
                >
                  Verify Payload
                </button>
              </div>
            </div>

            {bulkPreview.length > 0 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-300">
                <div className="flex items-center justify-between px-2">
                   <div className="flex items-center gap-4">
                      <div className="text-[10px] font-black uppercase tracking-widest text-success bg-success/10 px-3 py-1 rounded-lg border border-success/20">
                        {validCount} Verified
                      </div>
                      {errorCount > 0 && (
                        <div className="text-[10px] font-black uppercase tracking-widest text-destructive bg-destructive/10 px-3 py-1 rounded-lg border border-destructive/20">
                          {errorCount} Flagged
                        </div>
                      )}
                   </div>
                </div>

                <div className="kt-card border-border/50 overflow-hidden rounded-3xl max-h-[300px] overflow-y-auto shadow-none">
                  <table className="kt-table w-full">
                    <thead className="sticky top-0 bg-muted/90 backdrop-blur-md z-10">
                      <tr>
                        <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">Identity</th>
                        <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">IP Address</th>
                        <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">Assignment</th>
                        <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {bulkPreview.map((row, index) => (
                        <tr key={`${row.domain}-${index}`} className="hover:bg-muted/10 transition-colors">
                          <td className="px-6 py-4 text-xs font-bold text-foreground">{row.domain || '-'}</td>
                          <td className="px-6 py-4 text-xs font-mono text-primary">{row.ip || '-'}</td>
                          <td className="px-6 py-4 text-xs font-medium text-muted-foreground">{row.serverName || 'System Fallback'}</td>
                          <td className="px-6 py-4 text-right">
                            {row.error
                              ? <span className="text-[10px] font-black uppercase text-destructive">Rejected</span>
                              : <span className="text-[10px] font-black uppercase text-success">Verified</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {rowsNeedServer > 0 && (
                  <div className="p-8 rounded-[2rem] bg-warning/5 border border-warning/20 space-y-5">
                    <div className="flex items-center gap-3">
                       <span className="text-warning">⚡</span>
                       <h4 className="text-xs font-black text-warning uppercase tracking-widest">Target Deployment Node Required</h4>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {activeServers.length > 0 && (
                        <div className="flex flex-col gap-2">
                          <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest ml-1">Existing Cluster</label>
                          <select
                            value={defaultSrv}
                            onChange={event => {
                              setDefaultSrv(event.target.value);
                              setNewSrvName('');
                            }}
                            className="bg-background border border-border/50 rounded-2xl px-5 h-12 text-sm outline-none focus:border-primary transition-all appearance-none cursor-pointer"
                          >
                            <option value="">Select Target...</option>
                            {activeServers.map(server => (
                              <option key={server.id} value={server.name}>{server.name}</option>
                            ))}
                          </select>
                        </div>
                      )}

                      <div className="flex flex-col gap-2">
                        <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest ml-1">New Node provision</label>
                        <input
                          value={newSrvName}
                          onChange={event => {
                            setNewSrvName(event.target.value);
                            setDefaultSrv('');
                          }}
                          placeholder="Node-NY-102..."
                          className="bg-background border border-border/50 rounded-2xl px-5 h-12 text-sm outline-none focus:border-primary transition-all shadow-inner"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {validCount > 0 && (rowsNeedServer === 0 || defaultSrv || newSrvName) && (
                  <button
                    onClick={handleBulkSave}
                    disabled={bulkSaving}
                    className="kt-btn kt-btn-primary w-full h-14 rounded-[1.5rem] font-black text-xs uppercase tracking-[0.3em] shadow-xl shadow-primary/20 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-40"
                  >
                    {bulkSaving ? 'Ingesting Data...' : `Commit Ingestion Flow (${validCount} Records)`}
                  </button>
                )}
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* FIX 2: Quick Domain Reputation Panel */}
      {repPanel && (
        <QuickRepPanel
          domain={repPanel}
          latestRep={(() => {
            const recs = reputation.filter(r => r.domainId === repPanel.id);
            return recs.sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;
          })()}
          repHistory={reputation.filter(r => r.domainId === repPanel.id)
            .sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5)}
          onClose={() => setRepPanel(null)}
          onOpenFull={() => {
            const srv = servers.find(s => s.id === repPanel.serverId);
            if (srv) navigate(`/servers/${srv.id}`);
            setRepPanel(null);
          }}
        />
      )}

      {/* FIX 1: Bulk warmup drawer for single IP */}
      <Drawer open={warmupDrawerOpen} onClose={() => setWarmupDrawerOpen(false)}
        title={`Log Warmup`}
        subtitle="Log sent volume for the selected IP">
        <DField label="Emails Sent" required>
          <DInput type="number" value={warmupSent} onChange={e => setWarmupSent(e.target.value)}
            placeholder="e.g. 1000" min="0" autoFocus />
        </DField>
        <DField label="Date">
          <DInput type="date" value={warmupDate} onChange={e => setWarmupDate(e.target.value)} />
        </DField>
        <div className="mb-4">
          <div className="text-[10px] font-semibold uppercase tracking-wide mb-2 text-muted-foreground">
            Selected IP
          </div>
          <div className="px-3 py-2 rounded-lg bg-primary/10 border border-primary/20 flex items-center gap-2">
             <span className="text-[12px] font-mono font-bold text-primary">
               {ips.find(i => i.id === warmupIpId)?.ip || warmupIpId}
             </span>
          </div>
        </div>
        {warmupSent && (
          <div className="rounded-xl px-3 py-2 mb-4 text-[11px] font-medium"
            style={{ background: 'var(--success-bg)', color: 'var(--success)', border: '1px solid var(--success)20' }}>
            Will log {Number(warmupSent).toLocaleString()} emails on {warmupDate}
          </div>
        )}
        <DFooter onCancel={() => setWarmupDrawerOpen(false)} onSave={handleBulkWarmup}
          saving={warmupSaving} disabled={!warmupSent} saveLabel="Log Warmup" />
      </Drawer>
    </div>
  );
}

function QuickRepPanel({ domain, latestRep, repHistory, onClose, onOpenFull }: {
  domain: Domain;
  latestRep: any;
  repHistory: any[];
  onClose: () => void;
  onOpenFull: () => void;
}) {
  const score = domainHealthScore(domain, latestRep);
  const hc    = healthColor(score);
  const hl    = healthLabel(score);

  const repColor = (val: string) => {
    if (val === 'HIGH')   return 'var(--success)';
    if (val === 'MEDIUM') return 'var(--primary)';
    if (val === 'LOW')    return 'var(--warning)';
    if (val === 'BAD')    return 'var(--danger)';
    return 'var(--text3)';
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl bg-surface border border-border">

        {/* header */}
        <div className="px-5 py-4 flex items-center justify-between border-b border-border">
          <div>
            <div className="text-[14px] font-semibold font-mono text-primary">
              {domain.domain}
            </div>
            <div className="text-[11px] mt-0.5 text-muted-foreground">
              {domain.provider || 'Unknown provider'} · {domain.status}
            </div>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center bg-muted/50 text-muted-foreground hover:bg-muted transition-colors">✕</button>
        </div>

        {/* health score */}
        <div className="px-5 py-4 border-b border-border">
          <div className="flex items-center gap-4">
            <div className="relative w-16 h-16 shrink-0">
              <svg viewBox="0 0 64 64" className="w-16 h-16 -rotate-90">
                <circle cx="32" cy="32" r="27" fill="none" stroke="var(--border)" strokeWidth="5" />
                <circle cx="32" cy="32" r="27" fill="none" stroke={hc} strokeWidth="5"
                  strokeDasharray={`${(score / 100) * 169.6} 169.6`} strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-lg font-bold" style={{ color: hc }}>{score}</span>
              </div>
            </div>
            <div>
              <div className="text-[16px] font-bold" style={{ color: hc }}>{hl}</div>
              <div className="text-[12px] mt-0.5 text-muted-foreground">Domain Health Score</div>
              {latestRep && (
                <div className="text-[10px] mt-1 font-mono text-muted-foreground">
                  Data from {fmtDate(latestRep.date)}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* reputation snapshot */}
        <div className="px-5 py-4 border-b border-border">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Domain Rep', val: domain.domainRep ?? latestRep?.domainRep ?? '—' },
              { label: 'IP Rep',     val: domain.ipRep     ?? latestRep?.ipRep     ?? '—' },
              { label: 'Spam Rate',  val: domain.spamRate  ?? latestRep?.spamRate  ?? '0%' },
            ].map(row => (
              <div key={row.label} className="text-center">
                <div className="text-[10px] uppercase tracking-wide mb-1 text-muted-foreground">
                  {row.label}
                </div>
                <div className="text-[13px] font-bold" style={{ color: repColor(row.val as string) }}>
                  {row.val}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* last 5 history entries */}
        {repHistory.length > 0 && (
          <div className="px-5 py-3 border-b border-border">
            <div className="text-[10px] uppercase tracking-wide mb-2 text-muted-foreground">
              Recent History
            </div>
            <div className="space-y-1">
              {repHistory.map(r => (
                <div key={r.id} className="flex items-center justify-between text-[11px]">
                  <span className="font-mono text-muted-foreground">{fmtDate(r.date)}</span>
                  <span style={{ color: repColor(r.domainRep) }}>{r.domainRep}</span>
                  <span style={{ color: repColor(r.ipRep) }}>{r.ipRep}</span>
                  <span className="font-mono text-foreground opacity-80">{r.spamRate}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* footer */}
        <div className="px-5 py-4 flex gap-2">
          <button onClick={onClose} className="kt-btn kt-btn-light flex-1 h-10 rounded-xl text-xs font-bold uppercase tracking-widest shadow-none hover:bg-muted/50">Close</button>
          <button onClick={onOpenFull} className="kt-btn kt-btn-primary flex-1 h-10 rounded-xl text-xs font-bold uppercase tracking-[0.1em] shadow-lg shadow-primary/20 hover:scale-[1.02]">
            Full Details →
          </button>
        </div>
      </div>
    </div>
  );
}
