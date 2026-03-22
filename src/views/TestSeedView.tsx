import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRightCircle,
  Beaker,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Globe,
  Loader2,
  Plus,
  Save,
  Server,
  ShieldCheck,
} from 'lucide-react';

import { useAppContext } from '../App';
import ActionMenu from '../components/ActionMenu';
import EditTestSeedModal from '../components/EditTestSeedModal';
import { useConfirm } from '../hooks/useConfirm';
import { todayStr } from '../lib/constants';
import type { Domain, IP, Server as ServerType, TestSeed } from '../lib/types';

const ACTIVE_TEST_SEED_STATUSES = new Set<TestSeed['status']>(['draft', 'active', 'waiting_results']);

const InfrastructurePicker = ({
  servers,
  domains,
  ips,
  resetSignal,
  onSelectionChange,
}: {
  servers: ServerType[];
  domains: Domain[];
  ips: IP[];
  resetSignal: number;
  onSelectionChange: (selected: { serverId: string; domainId: string; ipId: string }[]) => void;
}) => {
  const [expandedServers, setExpandedServers] = useState<Set<string>>(new Set());
  const [expandedDomains, setExpandedDomains] = useState<Set<string>>(new Set());
  const [selectedIps, setSelectedIps] = useState<Set<string>>(new Set());

  useEffect(() => {
    setSelectedIps(new Set());
    onSelectionChange([]);
  }, [onSelectionChange, resetSignal]);

  const toggleServer = (id: string) => {
    const next = new Set(expandedServers);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedServers(next);
  };

  const toggleDomain = (id: string) => {
    const next = new Set(expandedDomains);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedDomains(next);
  };

  const toggleIp = (ipId: string) => {
    const next = new Set<string>();
    if (!selectedIps.has(ipId)) next.add(ipId);
    setSelectedIps(next);

    const combinations: { serverId: string; domainId: string; ipId: string }[] = [];
    next.forEach((id) => {
      const foundIp = ips.find((entry) => entry.id === id);
      if (!foundIp) return;

      const domain = domains.find((entry) => entry.id === foundIp.domainId);
      if (!domain) return;

      combinations.push({ serverId: domain.serverId, domainId: domain.id, ipId: foundIp.id });
    });

    onSelectionChange(combinations);
  };

  return (
    <div className="space-y-4 bg-slate-900/50 p-6 rounded-2xl border border-blue-500/20 backdrop-blur-xl">
      <div className="flex items-center gap-3 mb-4">
        <Server className="text-blue-400 w-5 h-5" />
        <h3 className="text-lg font-semibold text-white">Select Infrastructure</h3>
      </div>

      <div className="max-h-[400px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
        {servers.filter((server) => !server.archived).map((server) => (
          <div key={server.id} className="border border-white/5 rounded-xl overflow-hidden bg-white/5">
            <button
              onClick={() => toggleServer(server.id)}
              className="w-full flex items-center justify-between p-3 hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-3">
                {expandedServers.has(server.id)
                  ? <ChevronDown className="w-4 h-4 text-slate-400" />
                  : <ChevronRight className="w-4 h-4 text-slate-400" />}
                <Server className="w-4 h-4 text-blue-400" />
                <span className="font-medium text-slate-200">{server.name}</span>
              </div>
              <span className="text-xs text-slate-500 px-2 py-1 rounded-full bg-slate-800">
                {domains.filter((domain) => domain.serverId === server.id).length} Domains
              </span>
            </button>

            {expandedServers.has(server.id) && (
              <div className="pl-8 pb-3 pr-3 space-y-1">
                {domains.filter((domain) => domain.serverId === server.id).map((domain) => (
                  <div key={domain.id} className="border-l border-white/10 ml-2">
                    <button
                      onClick={() => toggleDomain(domain.id)}
                      className="w-full flex items-center justify-between p-2 hover:bg-white/5 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {expandedDomains.has(domain.id)
                          ? <ChevronDown className="w-4 h-4 text-slate-400" />
                          : <ChevronRight className="w-4 h-4 text-slate-400" />}
                        <Globe className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-sm text-slate-300">{domain.domain}</span>
                      </div>
                    </button>

                    {expandedDomains.has(domain.id) && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1 ml-6 pb-2">
                        {ips.filter((ip) => ip.domainId === domain.id).map((ip) => (
                          <label
                            key={ip.id}
                            className={`
                              flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-all
                              ${selectedIps.has(ip.id) ? 'bg-blue-500/20 border-blue-500/30' : 'bg-white/5 border-transparent'}
                              border hover:border-white/20
                            `}
                          >
                            <input
                              type="radio"
                              name="ip-selection"
                              className="hidden"
                              checked={selectedIps.has(ip.id)}
                              onChange={() => toggleIp(ip.id)}
                            />
                            <div
                              className={`
                                w-4 h-4 rounded border flex items-center justify-center transition-all
                                ${selectedIps.has(ip.id) ? 'bg-blue-500 border-blue-500' : 'border-slate-600'}
                              `}
                            >
                              {selectedIps.has(ip.id) && <CheckCircle2 className="w-3 h-3 text-white" />}
                            </div>
                            <div className="flex flex-col">
                              <span className="text-xs font-mono text-slate-200">{ip.ip}</span>
                              <span className="text-[10px] text-slate-500 uppercase">{ip.status || 'fresh'}</span>
                            </div>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default function TestSeedView() {
  const navigate = useNavigate();
  const { confirm } = useConfirm();
  const {
    testSeeds,
    testSeedItems,
    testSeedEvaluations,
    deliveries,
    servers,
    domains,
    ips,
    createTestSeed,
    updateTestSeed,
    deleteTestSeed,
    createTestSeedItem,
    updateTestSeedItem,
    createPostmasterTask,
    showToast,
  } = useAppContext();

  const [deliveryId, setDeliveryId] = useState('');
  const [testName, setTestName] = useState('');
  const [selection, setSelection] = useState<{ serverId: string; domainId: string; ipId: string }[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [pickerResetSignal, setPickerResetSignal] = useState(0);
  const [editingSeedId, setEditingSeedId] = useState<string | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const activeSeeds = useMemo(
    () => testSeeds
      .filter((seed) => ACTIVE_TEST_SEED_STATUSES.has(seed.status))
      .sort((left, right) => right.created_at.localeCompare(left.created_at)),
    [testSeeds],
  );

  const closedSeeds = useMemo(
    () => testSeeds
      .filter((seed) => !ACTIVE_TEST_SEED_STATUSES.has(seed.status))
      .sort((left, right) => right.created_at.localeCompare(left.created_at)),
    [testSeeds],
  );

  const editingSeed = useMemo(
    () => testSeeds.find((seed) => seed.id === editingSeedId) ?? null,
    [editingSeedId, testSeeds],
  );

  const editingSeedItem = useMemo(
    () => testSeedItems.find((item) => item.test_seed_id === editingSeedId) ?? null,
    [editingSeedId, testSeedItems],
  );

  const handleCreate = async () => {
    if (!deliveryId) {
      showToast({ type: 'error', message: 'Invalid input', description: 'Please select a delivery.' });
      return;
    }

    if (selection.length === 0) {
      showToast({ type: 'error', message: 'Invalid input', description: 'Please select one IP node.' });
      return;
    }

    if (selection.length > 1) {
      showToast({ type: 'error', message: 'Invalid input', description: 'Only one IP is allowed per test.' });
      return;
    }

    setIsSaving(true);
    try {
      const item = selection[0];
      const seed = await createTestSeed({
        delivery_id: deliveryId,
        server_id: item.serverId,
        domain_id: item.domainId,
        ip_id: item.ipId,
        name: testName || `Test ${todayStr()}`,
        status: 'active',
      });

      if (!seed) throw new Error('Failed to create parent seed');

      const seedItem = await createTestSeedItem({
        test_seed_id: seed.id,
        day1_target_sent: 500,
        day2_target_sent: 1000,
        status: 'pending',
      });

      if (seedItem) {
        await createPostmasterTask({
          test_seed_item_id: seedItem.id,
          task_type: 'check_day1',
          status: 'pending',
          scheduled_for: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        });
      }

      showToast({ type: 'success', message: 'Test created successfully' });
      showToast({ type: 'info', message: 'Results will be available after 48 hours' });
      setTestName('');
      setDeliveryId('');
      setSelection([]);
      setPickerResetSignal((current) => current + 1);
    } catch (error: any) {
      console.error(error);
      showToast({ type: 'error', message: error?.message || 'Action failed' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditSave = async (payload: { name: string; ipId: string; notes: string }) => {
    if (!editingSeed) return;

    const nextIP = ips.find((ip) => ip.id === payload.ipId);
    if (!nextIP) {
      throw new Error('Select a valid IP before saving.');
    }

    const nextDomain = domains.find((domain) => domain.id === nextIP.domainId);
    if (!nextDomain) {
      throw new Error('The selected IP is not linked to a valid domain.');
    }

    const nextServer = servers.find((server) => server.id === nextDomain.serverId);
    if (!nextServer) {
      throw new Error('The selected IP is not linked to a valid server.');
    }

    setIsSavingEdit(true);
    try {
      await updateTestSeed(editingSeed.id, {
        name: payload.name || editingSeed.name || `Test ${todayStr()}`,
        ip_id: nextIP.id,
        domain_id: nextDomain.id,
        server_id: nextServer.id,
      });

      if (editingSeedItem) {
        await updateTestSeedItem(editingSeedItem.id, { notes: payload.notes });
      }

      setEditingSeedId(null);
      showToast({ type: 'success', message: 'Test updated successfully' });
    } catch (error) {
      showToast({ type: 'error', message: 'Unable to save changes' });
      throw error;
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDelete = async (seed: TestSeed) => {
    const confirmed = await confirm({
      title: 'Delete Test',
      message: 'Are you sure you want to delete this test? Only TEST-SEED data will be removed.',
      confirmText: 'Confirm Delete',
      cancelText: 'Cancel',
      danger: true,
    });

    if (!confirmed) return;

    try {
      await deleteTestSeed(seed.id);
      showToast({ type: 'success', message: 'Test deleted successfully' });
    } catch (error) {
      showToast({ type: 'error', message: 'Unable to delete test' });
    }
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case 'good':
        return <ShieldCheck className="w-4 h-4 text-emerald-400" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-amber-400" />;
      case 'risky':
        return <AlertTriangle className="w-4 h-4 text-rose-400" />;
      default:
        return <Clock className="w-4 h-4 text-slate-400" />;
    }
  };

  const statusTone = (status: TestSeed['status']) => {
    switch (status) {
      case 'completed':
        return 'text-emerald-400';
      case 'failed':
        return 'text-rose-400';
      case 'waiting_results':
        return 'text-amber-400';
      default:
        return 'text-blue-400';
    }
  };

  const renderSeedCard = (seed: TestSeed, allowEvaluation: boolean) => {
    const linkedDomain = domains.find((domain) => domain.id === seed.domain_id);
    const linkedIP = ips.find((ip) => ip.id === seed.ip_id);
    const linkedItems = testSeedItems.filter((item) => item.test_seed_id === seed.id);
    const evaluation = testSeedEvaluations.find((entry) => entry.test_seed_id === seed.id);
    const note = linkedItems.find((item) => item.notes?.trim())?.notes?.trim();

    return (
      <div
        key={seed.id}
        className="bg-slate-900/40 rounded-2xl border border-white/5 overflow-hidden backdrop-blur-xl group hover:border-blue-500/30 transition-all duration-300"
      >
        <div className="p-5 flex items-start justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20 group-hover:bg-blue-500/20 transition-colors shrink-0">
              <Beaker className="w-6 h-6 text-blue-400" />
            </div>
            <div className="min-w-0">
              <h4 className="font-bold text-white text-lg">
                {seed.name || `Test ${new Date(seed.created_at).toLocaleDateString()}`}
              </h4>
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1">
                <span className="flex items-center gap-1.5 font-medium">
                  <Globe className="w-3.5 h-3.5" />
                  {linkedDomain?.domain ?? 'Unknown domain'}
                </span>
                <span className="w-1 h-1 rounded-full bg-slate-700" />
                <span className="font-mono text-[10px] uppercase">{linkedIP?.ip ?? 'Unknown IP'}</span>
                <span className={`font-semibold uppercase tracking-[0.18em] ${statusTone(seed.status)}`}>
                  {seed.status.replace('_', ' ')}
                </span>
              </div>
              {note && (
                <p className="mt-2 text-sm text-slate-400">{note}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {allowEvaluation ? (
              <button
                onClick={() => navigate(`/test-seed/${seed.id}`)}
                className="flex items-center gap-2 bg-blue-600/10 text-blue-400 hover:bg-blue-600 hover:text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all border border-blue-600/20 shadow-xl shadow-blue-900/10"
              >
                Evaluate Result
                <ArrowRightCircle className="w-4 h-4" />
              </button>
            ) : (
              <div className="px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-[0.18em] border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
                {evaluation ? 'Decision Saved' : 'Closed'}
              </div>
            )}

            <ActionMenu
              actions={[
                { label: 'Edit', onClick: () => setEditingSeedId(seed.id) },
                { label: 'Delete', onClick: () => { void handleDelete(seed); }, danger: true },
              ]}
            />
          </div>
        </div>

        <div className="px-5 pb-5 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-3 bg-white/5 rounded-xl border border-white/5">
            <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Status</p>
            <p className={`text-sm font-semibold capitalize ${statusTone(seed.status)}`}>
              {seed.status.replace('_', ' ')}
            </p>
          </div>
          <div className="p-3 bg-white/5 rounded-xl border border-white/5">
            <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Started</p>
            <p className="text-sm font-semibold text-slate-200">{new Date(seed.created_at).toLocaleDateString()}</p>
          </div>
          {linkedItems.map((item) => (
            <React.Fragment key={item.id}>
              <div className="p-3 bg-white/5 rounded-xl border border-white/5 text-center">
                <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Day 1 Progress</p>
                <div className="flex items-center justify-center gap-1.5">
                  {statusIcon(item.postmaster_day1 || 'pending')}
                  <span className="text-xs font-bold text-slate-200">
                    {item.day1_actual_sent || 0} / {item.day1_target_sent}
                  </span>
                </div>
              </div>
              <div className="p-3 bg-white/5 rounded-xl border border-white/5 text-center">
                <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Day 2 Progress</p>
                <div className="flex items-center justify-center gap-1.5">
                  {statusIcon(item.postmaster_day2 || 'pending')}
                  <span className="text-xs font-bold text-slate-200">
                    {item.day2_actual_sent || 0} / {item.day2_target_sent}
                  </span>
                </div>
              </div>
            </React.Fragment>
          ))}
          {!linkedItems.length && (
            <div className="col-span-2 p-3 bg-white/5 rounded-xl border border-white/5 text-center text-xs font-semibold text-slate-400">
              No TEST-SEED metrics recorded yet
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
            <Beaker className="text-blue-500" />
            TEST-SEED Infrastructure Evaluation
          </h1>
          <p className="text-slate-400 mt-2">Pre-scaling decision support layer with automated Postmaster outcomes.</p>
        </div>

        <div className="bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 rounded-xl flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-emerald-400 text-sm font-medium">Monitoring Active Tests</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-12 xl:col-span-5 space-y-6">
          <div className="bg-slate-900/50 p-6 rounded-2xl border border-white/5 backdrop-blur-xl space-y-6 shadow-2xl">
            <div className="flex items-center gap-3">
              <Plus className="text-blue-400 w-5 h-5" />
              <h3 className="text-lg font-semibold text-white">Create New Test</h3>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Target Delivery</label>
                <select
                  value={deliveryId}
                  onChange={(event) => setDeliveryId(event.target.value)}
                  className="w-full bg-slate-800/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 transition-all outline-none"
                >
                  <option value="">Select an existing delivery...</option>
                  {deliveries.map((delivery) => (
                    <option key={delivery.id} value={delivery.id}>{delivery.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Test Label (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Q1 Scaling Readiness"
                  value={testName}
                  onChange={(event) => setTestName(event.target.value)}
                  className="w-full bg-slate-800/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 transition-all outline-none"
                />
              </div>

              <div className="pt-4">
                <button
                  onClick={handleCreate}
                  disabled={isSaving || !deliveryId || selection.length !== 1}
                  className={`
                    w-full py-4 rounded-xl flex items-center justify-center gap-3 font-bold transition-all
                    ${isSaving || !deliveryId || selection.length !== 1
                      ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                      : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:shadow-lg hover:shadow-blue-500/20 active:scale-[0.98]'}
                  `}
                >
                  {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                  {isSaving ? 'Initializing...' : selection.length === 1 ? 'Start Test Now' : 'Select 1 IP to Start'}
                </button>
              </div>
            </div>
          </div>

          <InfrastructurePicker
            servers={servers}
            domains={domains}
            ips={ips}
            resetSignal={pickerResetSignal}
            onSelectionChange={setSelection}
          />
        </div>

        <div className="lg:col-span-12 xl:col-span-7 space-y-4">
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-[0.2em] mb-4">Active & Waiting Decisions</h3>
          {activeSeeds.map((seed) => renderSeedCard(seed, true))}

          {activeSeeds.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 bg-slate-900/50 rounded-3xl border border-dashed border-white/10 opacity-60">
              <div className="p-6 bg-white/5 rounded-full mb-4 border border-white/5">
                <Beaker className="w-10 h-10 text-slate-600" />
              </div>
              <h4 className="text-slate-300 text-lg font-bold">No items currently under evaluation</h4>
              <p className="text-slate-500 text-sm mt-2 max-w-xs text-center">
                Start a new evaluation cycle using the infrastructure picker on the left.
              </p>
            </div>
          )}

          {closedSeeds.length > 0 && (
            <>
              <h3 className="pt-6 text-sm font-bold text-slate-500 uppercase tracking-[0.2em]">Completed & Closed</h3>
              {closedSeeds.map((seed) => renderSeedCard(seed, false))}
            </>
          )}
        </div>
      </div>

      {editingSeed && (
        <EditTestSeedModal
          seed={editingSeed}
          item={editingSeedItem}
          servers={servers}
          domains={domains}
          ips={ips}
          testSeeds={testSeeds}
          saving={isSavingEdit}
          onClose={() => setEditingSeedId(null)}
          onSave={handleEditSave}
        />
      )}
    </div>
  );
}
