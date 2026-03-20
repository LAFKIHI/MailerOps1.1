import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../App';
import BulkActionPanel from '../components/BulkActionPanel';
import Modal, { Field, Input, ModalFooter } from '../components/Modal';
import ServerCard from '../components/ServerCard';
import { getServerRdp } from '../lib/server';
import { useConfirm } from '../hooks/useConfirm';

interface ParsedRow {
  domain: string;
  ip: string;
  serverName: string;
  error?: string;
}

function parseImportText(text: string): ParsedRow[] {
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const parts = line.includes(';')
        ? line.split(';').map(part => part.trim())
        : line.split(',').map(part => part.trim());
      const [domain = '', ip = '', serverName = ''] = parts;

      if (!domain) {
        return { domain: '', ip: '', serverName: '', error: `Line ${index + 1}: missing domain` };
      }

      if (!/^[a-zA-Z0-9][a-zA-Z0-9-_.]*\.[a-zA-Z]{2,}$/.test(domain)) {
        return {
          domain,
          ip,
          serverName,
          error: `Line ${index + 1}: "${domain}" does not look like a valid domain`,
        };
      }

      return { domain, ip: ip || '0.0.0.0', serverName };
    });
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

        const created = await createServer(resolvedName, '', []);
        if (created) serverIdMap[key] = created.id;
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
    <div className="space-y-6">
      <header className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="font-['Syne',sans-serif] text-lg font-bold text-[#e2e8f0]">Infrastructure Servers</h1>
          <p className="mt-1 text-xs font-mono text-[#5a6478]">
            {activeServers.length} visible server{activeServers.length !== 1 ? 's' : ''} grouped by RDP
          </p>
        </div>

        <div className="ml-auto flex flex-wrap gap-2">
          <input
            value={filter}
            onChange={event => setFilter(event.target.value)}
            placeholder="Filter by name, RDP, or tag..."
            className="w-56 rounded-md border border-[#252b32] bg-[#1a1e22] px-3 py-2 text-sm font-mono text-[#e2e8f0] outline-none transition-colors focus:border-[#4df0a0] placeholder:text-[#5a6478]"
          />

          <button
            onClick={() => {
              if (allVisibleSelected) {
                setSelectedServers(prev => prev.filter(id => !activeServers.some(server => server.id === id)));
                return;
              }

              setSelectedServers(prev => (
                [...new Set([...prev, ...activeServers.map(server => server.id)])]
              ));
            }}
            className="rounded-md border border-[#252b32] bg-[#1a1e22] px-4 py-2 text-sm font-mono text-[#9aa5b4] transition-all hover:border-[#4d8ff0] hover:text-[#4d8ff0]"
          >
            {allVisibleSelected ? 'Clear Visible' : 'Select Visible'}
          </button>

          <button
            onClick={() => {
              setBulkImportOpen(true);
              setBulkPreview([]);
              setBulkText('');
            }}
            className="rounded-md border border-[#252b32] bg-[#1a1e22] px-4 py-2 text-sm font-mono text-[#9aa5b4] transition-all hover:border-[#4d8ff0] hover:text-[#4d8ff0]"
          >
            Bulk Import
          </button>

          <button
            onClick={() => setAddOpen(true)}
            className="rounded-md bg-[#4df0a0] px-4 py-2 text-sm font-bold font-mono text-black transition-opacity hover:opacity-85"
          >
            New Server
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
        onSuccess={async (msg) => { await refreshData(); showToast(msg); }}
        onError={(msg) => { setBulkError(msg); showToast(msg, true); }}
        onClear={() => { clearSelectedServers(); setBulkRdp(''); setBulkDailyLimit(''); setBulkError(null); }}
      />

      {activeServers.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#2a313b] bg-[#111418] px-8 py-16 text-center">
          <p className="text-sm font-mono text-[#7a8596]">No servers match the current view.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {groupedServers.map(group => (
            <section key={group.rdp} className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full border border-[#1a3a6e] bg-[#0d1e3e] px-3 py-1 text-[11px] font-bold font-mono text-[#4d8ff0]">
                  {group.rdp === 'No RDP' ? 'No RDP' : `RDP ${group.rdp}`}
                </span>
                <span className="text-[11px] font-mono text-[#6e7b8f]">
                  {group.servers.length} server{group.servers.length !== 1 ? 's' : ''}
                </span>
                <div className="h-px flex-1 bg-[#252b32]" />
                <div className="flex flex-wrap gap-3 text-[11px] font-mono">
                  <span className="text-[#4d8ff0]">{group.totals.domains} domains</span>
                  <span className="text-[#4df0a0]">{group.totals.ips} IPs</span>
                  <span className="text-[#d8e0ea]">{group.totals.inbox} inbox</span>
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
        <Modal title="Bulk Import Domains" onClose={() => setBulkImportOpen(false)} size="lg">
          <div className="space-y-4">
            <div className="rounded-xl border border-[#1a3a6e] bg-[#0d1e3e]/50 px-4 py-3">
              <div className="text-[11px] font-bold text-[#4d8ff0]">Import format</div>
              <div className="mt-1 text-[11px] font-mono text-[#9aa5b4]">
                one line per domain: domain.com, 1.2.3.4, ServerName
              </div>
              <div className="mt-1 text-[10px] font-mono text-[#5a6478]">
                Server name is optional if you choose an existing or new fallback server below.
              </div>
            </div>

            <textarea
              value={bulkText}
              onChange={event => {
                setBulkText(event.target.value);
                setBulkPreview([]);
              }}
              rows={8}
              placeholder={'example.com, 192.168.1.1, Server-NY-01\ntest.org, 10.0.0.5'}
              className="w-full rounded-md border border-[#252b32] bg-[#1a1e22] px-3 py-2 text-xs font-mono text-[#e2e8f0] outline-none transition-colors focus:border-[#4d8ff0] placeholder:text-[#5a6478]"
            />

            <button
              onClick={() => setBulkPreview(parseImportText(bulkText))}
              disabled={!bulkText.trim()}
              className="rounded-md border border-[#252b32] bg-[#1a1e22] px-4 py-2 text-sm font-mono text-[#9aa5b4] transition-all hover:border-[#4d8ff0] hover:text-[#4d8ff0] disabled:opacity-40"
            >
              Preview rows
            </button>

            {bulkPreview.length > 0 && (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-3 text-xs font-mono">
                  <span className="text-[#4df0a0]">{validCount} valid</span>
                  {errorCount > 0 && <span className="text-[#f04d4d]">{errorCount} errors</span>}
                </div>

                <div className="max-h-56 overflow-y-auto rounded-xl border border-[#252b32]">
                  <table className="w-full text-xs font-mono">
                    <thead className="sticky top-0 bg-[#0f1217]">
                      <tr>
                        {['Domain', 'IP', 'Server', 'Status'].map(column => (
                          <th key={column} className="px-3 py-2 text-left text-[10px] uppercase tracking-widest text-[#5a6478]">
                            {column}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {bulkPreview.map((row, index) => (
                        <tr key={`${row.domain}-${index}`} className="border-t border-[#252b32]">
                          <td className="px-3 py-2 text-[#e2e8f0]">{row.domain || '-'}</td>
                          <td className="px-3 py-2 text-[#4d8ff0]">{row.ip || '-'}</td>
                          <td className="px-3 py-2 text-[#9aa5b4]">{row.serverName || 'fallback required'}</td>
                          <td className="px-3 py-2">
                            {row.error
                              ? <span className="text-[#f04d4d]">{row.error}</span>
                              : <span className="text-[#4df0a0]">ready</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {rowsNeedServer > 0 && (
                  <div className="rounded-xl border border-[#5c3a1a] bg-[#2e1e0d]/30 px-4 py-3">
                    <div className="text-[11px] font-mono text-[#f09a4d]">
                      {rowsNeedServer} row{rowsNeedServer > 1 ? 's need' : ' needs'} a fallback server.
                    </div>
                    <div className="mt-3 flex flex-wrap gap-3">
                      {activeServers.length > 0 && (
                        <select
                          value={defaultSrv}
                          onChange={event => {
                            setDefaultSrv(event.target.value);
                            setNewSrvName('');
                          }}
                          className="min-w-[220px] rounded-md border border-[#252b32] bg-[#1a1e22] px-3 py-2 text-sm font-mono text-[#e2e8f0] outline-none focus:border-[#4d8ff0]"
                        >
                          <option value="">Choose existing server</option>
                          {activeServers.map(server => (
                            <option key={server.id} value={server.name}>{server.name}</option>
                          ))}
                        </select>
                      )}

                      <Input
                        value={newSrvName}
                        onChange={event => {
                          setNewSrvName(event.target.value);
                          setDefaultSrv('');
                        }}
                        placeholder="Create new server"
                        className="min-w-[220px]"
                      />
                    </div>
                  </div>
                )}

                {validCount > 0 && (rowsNeedServer === 0 || defaultSrv || newSrvName) && (
                  <button
                    onClick={handleBulkSave}
                    disabled={bulkSaving}
                    className="w-full rounded-md bg-[#4df0a0] px-4 py-2 text-sm font-bold font-mono text-black transition-opacity hover:opacity-85 disabled:opacity-40"
                  >
                    {bulkSaving ? 'Importing...' : `Import ${validCount} domain${validCount > 1 ? 's' : ''}`}
                  </button>
                )}
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
