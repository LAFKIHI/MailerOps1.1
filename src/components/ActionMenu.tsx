import { useState, useRef, useEffect } from 'react';

interface ActionItem {
  label: string;
  onClick: () => void;
  icon?: string;
  danger?: boolean;
}

export default function ActionMenu({ actions }: { actions: ActionItem[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative inline-block text-left" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="w-8 h-8 flex items-center justify-center rounded-xl text-muted-foreground hover:text-primary hover:bg-primary/5 border border-transparent hover:border-primary/20 transition-all active:scale-90"
      >
        <div className="flex gap-0.5">
          <span className="w-1 h-1 rounded-full bg-current" />
          <span className="w-1 h-1 rounded-full bg-current" />
          <span className="w-1 h-1 rounded-full bg-current" />
        </div>
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-48 rounded-2xl bg-background/90 backdrop-blur-xl shadow-2xl shadow-black/20 border border-border/50 py-2 animate-in fade-in zoom-in-95 duration-200">
          {actions.map((action, i) => (
            <button
              key={i}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setOpen(false);
                action.onClick();
              }}
              className={`w-full text-left px-5 py-2.5 text-xs font-bold transition-all flex items-center gap-3 hover:bg-primary/5 group ${
                action.danger ? 'text-destructive hover:text-destructive' : 'text-foreground hover:text-primary'
              }`}
            >
              {action.icon && <span className="text-sm opacity-60 group-hover:opacity-100 transition-opacity">{action.icon}</span>}
              <span className="flex-1">{action.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
