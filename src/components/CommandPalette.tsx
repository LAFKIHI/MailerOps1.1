import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
      setQuery('');
      setSelectedIndex(0);
    }
  }, [open]);

  if (!open) return null;

  const commands = [
    { label: 'Go to Home', action: () => navigate('/') },
    { label: 'Go to Deliveries', action: () => navigate('/deliveries') },
    { label: 'Go to Servers', action: () => navigate('/servers') },
    { label: 'Go to Analytics', action: () => navigate('/history') },
    { label: 'Go to Settings', action: () => navigate('/settings') },
    { label: 'Close Palette', action: () => setOpen(false) },
  ];

  const filtered = commands.filter((cmd) =>
    cmd.label.toLowerCase().includes(query.toLowerCase())
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % filtered.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filtered.length) % filtered.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[selectedIndex]) {
        filtered[selectedIndex].action();
        setOpen(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh] bg-black/50">
      <div className="w-full max-w-lg rounded-xl bg-[#131619] border border-[#252b32] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center px-4 py-3 border-b border-[#252b32]">
          <span className="text-[#5a6478] mr-3">🔍</span>
          <input
            ref={inputRef}
            type="text"
            className="flex-1 bg-transparent border-none outline-none text-[#e2e8f0] placeholder-[#5a6478] font-mono text-sm"
            placeholder="Search commands..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
          />
          <button onClick={() => setOpen(false)} className="text-[#5a6478] hover:text-[#e2e8f0] text-xs font-mono ml-2 border border-[#252b32] rounded px-1.5 py-0.5">ESC</button>
        </div>
        <div className="max-h-64 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <div className="text-center py-4 text-[#5a6478] text-sm font-mono">No commands found.</div>
          ) : (
            filtered.map((cmd, i) => (
              <div
                key={cmd.label}
                onClick={() => {
                  cmd.action();
                  setOpen(false);
                }}
                className={`px-3 py-2 rounded-md cursor-pointer text-sm font-mono flex items-center transition-colors
                  ${i === selectedIndex ? 'bg-[#1a1e22] text-[#4df0a0]' : 'text-[#9aa5b4] hover:bg-[#1a1e22] hover:text-[#e2e8f0]'}`}
                onMouseEnter={() => setSelectedIndex(i)}
              >
                {cmd.label}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
