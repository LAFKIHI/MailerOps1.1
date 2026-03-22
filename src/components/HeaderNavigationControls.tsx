import { startTransition, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Home, RefreshCw } from 'lucide-react';
import { useLocation, useNavigate, useNavigationType } from 'react-router-dom';

type StoredHistory = {
  entries: string[];
  index: number;
};

const HISTORY_STORAGE_KEY = 'mailerops-header-history';

function readStoredHistory(): StoredHistory {
  if (typeof window === 'undefined') {
    return { entries: [], index: 0 };
  }

  try {
    const raw = window.sessionStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return { entries: [], index: 0 };

    const parsed = JSON.parse(raw) as Partial<StoredHistory>;
    return {
      entries: Array.isArray(parsed.entries) ? parsed.entries : [],
      index: typeof parsed.index === 'number' ? parsed.index : 0,
    };
  } catch {
    return { entries: [], index: 0 };
  }
}

function writeStoredHistory(history: StoredHistory) {
  if (typeof window === 'undefined') return;

  try {
    window.sessionStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
  } catch {}
}

function NavButton({
  label,
  disabled = false,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="h-9 w-9 rounded-xl border border-border bg-surface-elevated text-foreground-muted transition-all hover:border-primary/20 hover:bg-primary/5 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
    >
      <span className="flex items-center justify-center">{children}</span>
    </button>
  );
}

export default function HeaderNavigationControls() {
  const navigate = useNavigate();
  const location = useLocation();
  const navigationType = useNavigationType();
  const [historyState, setHistoryState] = useState<StoredHistory>({ entries: [], index: 0 });

  const currentEntry = useMemo(
    () => `${location.key}:${location.pathname}${location.search}${location.hash}`,
    [location.hash, location.key, location.pathname, location.search],
  );

  useEffect(() => {
    const snapshot = readStoredHistory();
    const knownIndex = snapshot.entries.indexOf(currentEntry);
    let nextHistory: StoredHistory;

    if (!snapshot.entries.length) {
      nextHistory = { entries: [currentEntry], index: 0 };
    } else if (navigationType === 'POP' && knownIndex >= 0) {
      nextHistory = { ...snapshot, index: knownIndex };
    } else if (navigationType === 'REPLACE') {
      const safeIndex = Math.min(Math.max(snapshot.index, 0), snapshot.entries.length - 1);
      const nextEntries = [...snapshot.entries];
      nextEntries[safeIndex] = currentEntry;
      nextHistory = { entries: nextEntries, index: safeIndex };
    } else if (knownIndex >= 0) {
      nextHistory = { ...snapshot, index: knownIndex };
    } else {
      const nextEntries = snapshot.entries.slice(0, snapshot.index + 1);
      nextEntries.push(currentEntry);
      nextHistory = { entries: nextEntries, index: nextEntries.length - 1 };
    }

    writeStoredHistory(nextHistory);
    setHistoryState(nextHistory);
  }, [currentEntry, navigationType]);

  const canGoBack = historyState.index > 0;
  const canGoForward = historyState.index < historyState.entries.length - 1;

  const safelyRun = (action: () => void) => () => {
    try {
      action();
    } catch (error) {
      console.warn('Header navigation action failed:', error);
    }
  };

  return (
    <div className="flex items-center gap-2 shrink-0" aria-label="Header navigation controls">
      <NavButton label="Back" disabled={!canGoBack} onClick={safelyRun(() => window.history.back())}>
        <ChevronLeft size={16} />
      </NavButton>
      <NavButton label="Forward" disabled={!canGoForward} onClick={safelyRun(() => window.history.forward())}>
        <ChevronRight size={16} />
      </NavButton>
      <NavButton
        label="Home"
        onClick={safelyRun(() => {
          startTransition(() => navigate('/'));
        })}
      >
        <Home size={16} />
      </NavButton>
      <NavButton label="Refresh" onClick={safelyRun(() => window.location.reload())}>
        <RefreshCw size={15} />
      </NavButton>
    </div>
  );
}
