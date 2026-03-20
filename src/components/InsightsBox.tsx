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
    <div className="fixed top-16 right-4 z-50 w-80 bg-[#131619] border border-[#252b32] rounded-lg shadow-xl overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#252b32] bg-[#0d0f11]">
        <span className="text-[11px] font-mono font-bold uppercase tracking-widest text-[#4d8ff0]">💡 System Insights</span>
        <button onClick={() => setIsOpen(false)} className="text-[#5a6478] hover:text-[#e2e8f0] text-xs transition-colors">✕</button>
      </div>
      <div className="p-3 space-y-2 max-h-48 overflow-y-auto">
        {suggestions.map(alert => (
          <div key={alert.id} className={`p-2 rounded border text-[11px] font-mono ${alert.type === 'warning' ? 'bg-[#2e0d0d] border-[#f04d4d]/30 text-[#f04d4d]' : 'bg-[#0d1e3e] border-[#4d8ff0]/30 text-[#4d8ff0]'}`}>
            {alert.type === 'warning' ? '⚠ ' : 'ℹ '} {alert.message}
          </div>
        ))}
      </div>
    </div>
  );
}
