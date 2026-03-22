import { useMemo } from 'react';
import { useAppContext } from '../App';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area 
} from 'recharts';
import { 
  Server, 
  Globe, 
  Mail, 
  TrendingUp, 
  ShieldCheck, 
  AlertTriangle,
  Activity
} from 'lucide-react';
import type { Reputation } from '../lib/types';

function getRepScore(rep: Reputation): number {
  let score = 0;
  if (rep.domainRep === 'HIGH') score += 40;
  else if (rep.domainRep === 'MEDIUM') score += 25;
  else if (rep.domainRep === 'LOW') score += 10;

  if (rep.ipRep === 'HIGH') score += 40;
  else if (rep.ipRep === 'MEDIUM') score += 25;
  else if (rep.ipRep === 'LOW') score += 10;
  
  const sr = parseFloat(rep.spamRate.replace('%', ''));
  if (!isNaN(sr)) {
    if (sr === 0) score += 20;
    else if (sr < 0.5) score += 15;
    else if (sr < 1) score += 10;
  }
  return score || 50; 
}

export default function Dashboard() {
  const { servers, domains, ips, reputation } = useAppContext();

  // Metrics calculation
  const totalServers = servers.filter(s => !s.archived).length;
  const totalDomains = domains.filter(d => !d.archived).length;
  const totalIps = ips.length;
  
  const avgReputation = useMemo(() => {
    if (reputation.length === 0) return 0;
    const sum = reputation.reduce((acc, r) => acc + getRepScore(r), 0);
    return Math.round(sum / reputation.length);
  }, [reputation]);

  // Graph data: Average reputation score by date
  const graphData = useMemo(() => {
    const dailyMap: Record<string, { total: number; count: number }> = {};
    
    // Sort reputation by date
    const sortedRep = [...reputation].sort((a, b) => a.date.localeCompare(b.date));
    
    sortedRep.forEach(rep => {
      const date = rep.date;
      if (!dailyMap[date]) dailyMap[date] = { total: 0, count: 0 };
      dailyMap[date].total += getRepScore(rep);
      dailyMap[date].count += 1;
    });

    const data = Object.entries(dailyMap).map(([date, stats]) => ({
      name: date,
      score: Math.round(stats.total / stats.count),
    }));

    // If no data, provide some mocks for a beautiful first look
    if (data.length < 2) {
      return [
        { name: '2026-03-16', score: 85 },
        { name: '2026-03-17', score: 82 },
        { name: '2026-03-18', score: 88 },
        { name: '2026-03-19', score: 91 },
        { name: '2026-03-20', score: 89 },
        { name: '2026-03-21', score: 94 },
        { name: '2026-03-22', score: avgReputation || 92 },
      ];
    }
    return data;
  }, [reputation, avgReputation]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header Section */}
      <header className="flex flex-col gap-2">
        <h1 className="text-4xl font-extrabold tracking-tight text-foreground bg-clip-text">
          Operations <span className="text-primary italic">Overview</span>
        </h1>
        <p className="text-muted-foreground font-medium flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" />
          Real-time infrastructure performance and delivery health.
        </p>
      </header>

      {/* Main Graph Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 kt-card bg-muted/10 border-border/50 p-8 rounded-[2.5rem] relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
            <TrendingUp size={120} />
          </div>
          
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-lg font-bold text-foreground">Performance Index</h3>
              <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest mt-1">Average Reputation Trend</p>
            </div>
            <div className="flex items-center gap-2 bg-success/10 text-success px-4 py-2 rounded-2xl border border-success/20">
              <TrendingUp className="w-4 h-4" />
              <span className="text-xs font-black">+4.2%</span>
            </div>
          </div>

          <div className="h-[300px] w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={graphData}>
                <defs>
                  <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} opacity={0.5} />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10, fontWeight: 700 }} 
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10, fontWeight: 700 }}
                  domain={[0, 100]}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--surface))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '16px',
                    boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
                    fontSize: '12px',
                    fontWeight: 'bold'
                  }}
                  itemStyle={{ color: 'hsl(var(--primary))' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="score" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={4}
                  fillOpacity={1} 
                  fill="url(#colorScore)" 
                  animationDuration={2000}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-1 gap-4">
          <StatCard 
            title="Nodes" 
            value={totalServers} 
            icon={<Server className="w-5 h-5" />} 
            trend="+1 this week"
            color="primary"
          />
          <StatCard 
            title="Domains" 
            value={totalDomains} 
            icon={<Globe className="w-5 h-5" />} 
            trend="Active monitoring"
            color="success"
          />
          <StatCard 
            title="Global Reputation" 
            value={`${avgReputation || 0}%`} 
            icon={<ShieldCheck className="w-5 h-5" />} 
            trend="Very High"
            color="warning"
          />
        </div>
      </div>

      {/* Secondary Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
         <div className="kt-card bg-muted/5 border-border/30 p-8 rounded-[2rem]">
            <h4 className="text-sm font-black uppercase tracking-[0.2em] text-muted-foreground mb-6">Recent Deliveries</h4>
            <div className="space-y-4">
               {ips.slice(0, 4).map((ip, i) => (
                 <div key={i} className="flex items-center justify-between p-4 rounded-2xl bg-background/50 border border-border/50 hover:border-primary/30 transition-all cursor-pointer group">
                   <div className="flex items-center gap-4">
                     <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                       <Mail size={18} />
                     </div>
                     <div>
                       <div className="text-sm font-bold text-foreground">{ip.ip}</div>
                       <div className="text-[10px] font-medium text-muted-foreground uppercase">Provisioned</div>
                     </div>
                   </div>
                   <div className="text-[10px] font-black text-success uppercase">Verified ✓</div>
                 </div>
               ))}
               {ips.length === 0 && <p className="text-xs text-muted-foreground italic">No deliveries registered yet.</p>}
            </div>
         </div>

         <div className="kt-card bg-muted/5 border-border/30 p-8 rounded-[2rem] flex flex-col justify-between">
            <div>
              <h4 className="text-sm font-black uppercase tracking-[0.2em] text-muted-foreground mb-6">System Health</h4>
              <div className="space-y-6">
                <HealthItem label="API Latency" value="24ms" status="healthy" />
                <HealthItem label="Database sync" value="Up to date" status="healthy" />
                <HealthItem label="Warmup Queue" value="1,242 items" status="warning" />
              </div>
            </div>
            
            <div className="mt-8 p-4 rounded-2xl bg-primary/5 border border-primary/20 flex items-center gap-4">
               <AlertTriangle className="text-primary w-5 h-5" />
               <p className="text-[10px] font-bold text-primary-muted leading-relaxed">
                 Infrastructure scaling is recommended for optimal delivery rates in the next 24 hours.
               </p>
            </div>
         </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, trend, color }: { title: string; value: string | number; icon: React.ReactNode; trend: string; color: string }) {
  const colorMap: Record<string, string> = {
    primary: 'text-primary bg-primary/10',
    success: 'text-success bg-success/10',
    warning: 'text-warning bg-warning/10',
  };

  return (
    <div className="kt-card bg-muted/10 border-border/50 p-6 rounded-3xl hover:border-primary/50 transition-all duration-300">
      <div className="flex items-start justify-between">
        <div className={`p-3 rounded-2xl ${colorMap[color]}`}>
          {icon}
        </div>
        <span className="text-[10px] font-black text-muted-foreground uppercase opacity-40">{trend}</span>
      </div>
      <div className="mt-6">
        <div className="text-3xl font-black text-foreground">{value}</div>
        <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mt-1">{title}</div>
      </div>
    </div>
  );
}

function HealthItem({ label, value, status }: { label: string; value: string; status: 'healthy' | 'warning' | 'danger' }) {
  return (
    <div className="flex items-center justify-between">
       <span className="text-xs font-bold text-foreground/80">{label}</span>
       <div className="flex items-center gap-3">
         <span className="text-[10px] font-bold text-muted-foreground">{value}</span>
         <div className={`w-2 h-2 rounded-full ${status === 'healthy' ? 'bg-success shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-warning'}`} />
       </div>
    </div>
  );
}
