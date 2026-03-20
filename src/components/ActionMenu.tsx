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
        className="text-[#9aa5b4] hover:text-[#e2e8f0] px-2 py-1 rounded transition-colors text-lg leading-none"
      >
        ⋮
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-1 w-32 rounded-md bg-[#1a1e22] shadow-lg border border-[#252b32] py-1">
          {actions.map((action, i) => (
            <button
              key={i}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setOpen(false);
                action.onClick();
              }}
              className={`w-full text-left px-4 py-2 text-xs font-mono transition-colors hover:bg-[#252b32] ${
                action.danger ? 'text-[#f04d4d]' : 'text-[#e2e8f0]'
              }`}
            >
              {action.icon && <span className="mr-2">{action.icon}</span>}
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
