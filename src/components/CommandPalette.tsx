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
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-6 bg-background/40 backdrop-blur-sm animate-in fade-in duration-300">
      <div 
        className="w-full max-w-xl rounded-[2.5rem] bg-background border border-border shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 shadow-black/20"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-4 px-8 py-6 border-b border-border bg-muted/20">
          <span className="text-xl opacity-40">🔍</span>
          <input
            ref={inputRef}
            type="text"
            className="flex-1 bg-transparent border-none outline-none text-foreground font-bold placeholder:text-muted-foreground/30 text-base"
            placeholder="Summon operational command..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
          />
          <div className="flex items-center gap-2">
             <kbd className="h-6 px-1.5 rounded-lg border border-border bg-background text-[10px] font-black text-muted-foreground flex items-center justify-center shadow-sm">ESC</kbd>
             <button onClick={() => setOpen(false)} className="w-8 h-8 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all">✕</button>
          </div>
        </div>
        <div className="max-h-[400px] overflow-y-auto p-4 space-y-1">
          {filtered.length === 0 ? (
            <div className="text-center py-12 space-y-2 opacity-40">
               <div className="text-2xl">🛰️</div>
               <div className="text-xs font-black uppercase tracking-widest text-muted-foreground">No matching protocols found</div>
            </div>
          ) : (
            filtered.map((cmd, i) => (
              <div
                key={cmd.label}
                onClick={() => {
                  cmd.action();
                  setOpen(false);
                }}
                className={`px-6 py-4 rounded-2xl cursor-pointer text-sm font-bold flex items-center justify-between transition-all group
                  ${i === selectedIndex 
                    ? 'bg-primary text-white shadow-xl shadow-primary/20 scale-[1.01]' 
                    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'}`}
                onMouseEnter={() => setSelectedIndex(i)}
              >
                <span>{cmd.label}</span>
                {i === selectedIndex && <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Execute ↵</span>}
              </div>
            ))
          )}
        </div>
        <div className="px-8 py-3 bg-muted/10 border-t border-border/30 flex items-center justify-between">
           <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest opacity-40">Neural Link v1.1</span>
           <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5 grayscale opacity-40">
                 <kbd className="h-4 px-1 rounded-md border border-border text-[8px] font-bold">↑</kbd>
                 <kbd className="h-4 px-1 rounded-md border border-border text-[8px] font-bold">↓</kbd>
                 <span className="text-[8px] font-bold uppercase">Navigate</span>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
