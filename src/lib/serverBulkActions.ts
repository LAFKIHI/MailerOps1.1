export type ServerBulkActionKey =
  | 'updateSendPerDay'
  | 'change_daily_limit'
  | 'change_rdp'
  | 'startServers'
  | 'stopServers'
  | 'deleteServers'
  | 'updateStatus'
  | 'assignTag'
  | 'stop'
  | 'start'
  | 'pause'
  | 'resume';

export function validateServerBulkAction(action: ServerBulkActionKey, rawValue: string): string | null {
  const value = rawValue.trim();

  if (action === 'updateSendPerDay') {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 1000000) {
      return 'Send per day must be an integer between 0 and 1000000';
    }
  }

  if (action === 'change_daily_limit') {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 1000000) {
      return 'Daily limit must be an integer between 0 and 1000000';
    }
  }

  if (action === 'change_rdp') {
    if (!value || value.length > 100) {
      return 'RDP must be between 1 and 100 characters';
    }
  }

  if (action === 'updateStatus') {
    if (!['active', 'paused', 'banned'].includes(value)) {
      return 'Choose a valid server status';
    }
  }

  if (action === 'assignTag') {
    if (!value || value.length > 40 || !/^[A-Za-z0-9 _-]+$/.test(value)) {
      return 'Tag must be 1-40 characters and use letters, numbers, spaces, "_" or "-"';
    }
  }

  return null;
}

export function parseServerBulkActionValue(action: ServerBulkActionKey, rawValue: string): unknown {
  if (action === 'updateSendPerDay' || action === 'change_daily_limit') {
    return Number(rawValue.trim());
  }

  if (
    action === 'startServers' || action === 'stopServers' || action === 'deleteServers' ||
    action === 'stop' || action === 'start' || action === 'pause' || action === 'resume'
  ) {
    return undefined;
  }

  return rawValue.trim();
}
