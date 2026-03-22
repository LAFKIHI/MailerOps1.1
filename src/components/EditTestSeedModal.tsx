import { useEffect, useMemo, useState } from 'react';
import Modal, { Field, Input, Select } from './Modal';
import type { Domain, IP, Server, TestSeed, TestSeedItem } from '../lib/types';

const ACTIVE_SEED_STATUSES = new Set<TestSeed['status']>(['draft', 'active', 'waiting_results']);

type IPOption = {
  id: string;
  ip: string;
  domain: string;
  server: string;
  status: NonNullable<IP['status']>;
};

export default function EditTestSeedModal({
  seed,
  item,
  servers,
  domains,
  ips,
  testSeeds,
  saving = false,
  onClose,
  onSave,
}: {
  seed: TestSeed;
  item?: TestSeedItem | null;
  servers: Server[];
  domains: Domain[];
  ips: IP[];
  testSeeds: TestSeed[];
  saving?: boolean;
  onClose: () => void;
  onSave: (payload: { name: string; ipId: string; notes: string }) => Promise<void>;
}) {
  const [name, setName] = useState(seed.name ?? '');
  const [ipId, setIpId] = useState(seed.ip_id);
  const [notes, setNotes] = useState(item?.notes ?? '');
  const [formError, setFormError] = useState('');

  useEffect(() => {
    setName(seed.name ?? '');
    setIpId(seed.ip_id);
    setNotes(item?.notes ?? '');
    setFormError('');
  }, [item?.id, item?.notes, seed.id, seed.ip_id, seed.name]);

  const ipOptions = useMemo<IPOption[]>(() => (
    ips
      .map((ip) => {
        const domain = domains.find((entry) => entry.id === ip.domainId);
        const server = domain ? servers.find((entry) => entry.id === domain.serverId) : null;

        if (!domain || !server) return null;

        return {
          id: ip.id,
          ip: ip.ip,
          domain: domain.domain,
          server: server.name,
          status: ip.status ?? 'fresh',
        };
      })
      .filter((option): option is IPOption => Boolean(option))
      .sort((left, right) => left.ip.localeCompare(right.ip))
  ), [domains, ips, servers]);

  const selectedIP = ipOptions.find((option) => option.id === ipId) ?? null;

  const handleSave = async () => {
    setFormError('');

    if (!ipId) {
      setFormError('Select one IP for this test.');
      return;
    }

    const conflictingSeed = testSeeds.find((entry) =>
      entry.id !== seed.id &&
      entry.ip_id === ipId &&
      ACTIVE_SEED_STATUSES.has(entry.status),
    );

    if (conflictingSeed) {
      setFormError('This IP is already assigned to another active test.');
      return;
    }

    try {
      await onSave({
        name: name.trim(),
        ipId,
        notes: notes.trim(),
      });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Unable to save changes');
    }
  };

  return (
    <Modal title="Edit Test" onClose={onClose} size="md">
      <div className="space-y-5">
        <p className="text-sm text-muted-foreground">
          Only TEST-SEED fields are editable here. Delivery and shared infrastructure records stay untouched.
        </p>

        <Field label="Test Label / Name">
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Q1 Scaling Readiness"
          />
        </Field>

        <Field label="Assigned IP">
          <Select value={ipId} onChange={(event) => setIpId(event.target.value)}>
            {ipOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.ip} - {option.domain} - {option.server}
              </option>
            ))}
          </Select>
        </Field>

        {selectedIP && (
          <div className="rounded-2xl border border-border bg-surface-elevated/60 p-4 text-sm text-foreground-muted">
            <div className="font-medium text-foreground">{selectedIP.ip}</div>
            <div className="mt-1">{selectedIP.domain} on {selectedIP.server}</div>
            <div className="mt-1 text-xs uppercase tracking-[0.2em] text-muted">
              Status: {selectedIP.status}
            </div>
          </div>
        )}

        <Field label="Notes">
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Add optional notes for this TEST-SEED run"
            className="field-input min-h-[120px] resize-y"
          />
        </Field>

        {formError && (
          <div className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
            {formError}
          </div>
        )}

        <div className="flex justify-end gap-3 border-t border-border pt-4">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button type="button" onClick={handleSave} disabled={saving} className="btn-primary">
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
