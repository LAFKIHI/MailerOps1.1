import { useState, useMemo } from 'react';
import { useAppContext } from '../App';
import { FEATURES } from '../lib/features';

export default function InsightsBox() {
  const [isOpen, setIsOpen] = useState(true);
  const { ips } = useAppContext();

  const suggestions = useMemo(() => {
    const alerts: { id: string; type: 'warning' | 'info'; message: string }[] = [];
    
    if (!FEATURES.SUGGESTIONS) return alerts;

    const riskyIps = ips.filter(ip => (ip.health_score ?? 100) < 50 && ip.status !== 'burned');
    if (riskyIps.length > 0) {
      alerts.push({
        id: 'risky-ips',
        type: 'warning',
        message: `You have ${riskyIps.length} risky IP(s) that need resting.`
      });
    }

    const scalingIps = ips.filter(ip => (ip.total_sent ?? 0) >= 10000 && ip.status !== 'scaled' && ip.status !== 'burned');
    scalingIps.slice(0, 3).forEach(ip => {
      alerts.push({
        id: `scale-${ip.id}`,
        type: 'info',
        message: `IP ${ip.ip} has hit 10k+ total volume, suggest scaling.`
      });
    });

    return alerts;
  }, [ips]);

  if (!FEATURES.SUGGESTIONS || suggestions.length === 0 || !isOpen) return null;

  return (
    <div className="fixed top-24 right-8 z-50 w-80 bg-background/80 backdrop-blur-xl border border-primary/20 rounded-[2rem] shadow-2xl shadow-primary/10 overflow-hidden animate-in slide-in-from-right-8 duration-500">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border/50 bg-primary/5">
        <div className="flex items-center gap-2">
          <span className="text-primary animate-pulse">💡</span>
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground">Operational Intelligence</span>
        </div>
        <button onClick={() => setIsOpen(false)} className="w-6 h-6 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all active:scale-90">✕</button>
      </div>
      <div className="p-6 space-y-3 max-h-64 overflow-y-auto">
        {suggestions.map(alert => (
          <div key={alert.id} className={`p-4 rounded-2xl border flex gap-3 animate-in fade-in slide-in-from-top-2 duration-300 ${
            alert.type === 'warning' 
              ? 'bg-destructive/5 border-destructive/20 text-destructive' 
              : 'bg-primary/5 border-primary/20 text-primary'
          }`}>
            <span className="text-xs">{alert.type === 'warning' ? '⚠️' : 'ℹ️'}</span>
            <p className="text-[11px] font-bold leading-relaxed">{alert.message}</p>
          </div>
        ))}
      </div>
      <div className="px-6 py-3 bg-muted/20 border-t border-border/50 text-center">
         <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest opacity-40 italic">Shadow Layer Active</span>
      </div>
    </div>
  );
}
