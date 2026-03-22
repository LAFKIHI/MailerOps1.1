import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../App';
import ScreenContainer from '../components/ScreenContainer';
import Drawer, { DField, DFooter, DInput } from '../components/Drawer';
import { domainHealthScore, healthColor, healthLabel } from '../lib/types';

export default function DomainesView() {
  const { servers, domains, ips, reputation, importDomains, showToast } = useAppContext();
  const navigate = useNavigate();
  const [filter, setFilter] = useState('');
  const [healthFilter, setHealthFilter] = useState<string>('all');
  
  // New domain drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [csvContent, setCsvContent] = useState('');
  const [saving, setSaving] = useState(false);

  const enrichedDomains = useMemo(() => {
    return domains
      .filter(d => !d.archived)
      .map(d => {
        const server = servers.find(s => s.id === d.serverId);
        const latestRep = reputation
          .filter(r => r.domainId === d.id)
          .sort((a, b) => b.date.localeCompare(a.date))[0] || null;
        const domainIps = ips.filter(ip => ip.domainId === d.id);
        const score = domainHealthScore(d, latestRep);
        return {
          ...d,
          serverName: server?.name || 'Non assigné',
          score,
          scoreColor: healthColor(score),
          scoreLabel: healthLabel(score),
          ipCount: domainIps.length,
          latestRep,
          warmupIps: domainIps.filter(ip => (ip.warmup_day || 0) > 0).length,
        };
      })
      .filter(d => {
        if (filter) {
          const q = filter.toLowerCase();
          if (!d.domain.toLowerCase().includes(q) && !d.serverName.toLowerCase().includes(q)) return false;
        }
        if (healthFilter !== 'all') {
          if (healthFilter === 'excellent' && d.score < 80) return false;
          if (healthFilter === 'good' && (d.score < 55 || d.score >= 80)) return false;
          if (healthFilter === 'risk' && (d.score < 30 || d.score >= 55)) return false;
          if (healthFilter === 'critical' && d.score >= 30) return false;
        }
        return true;
      })
      .sort((a, b) => b.score - a.score);
  }, [domains, servers, ips, reputation, filter, healthFilter]);

  const groupedByServer = useMemo(() => {
    const map: Record<string, typeof enrichedDomains> = {};
    enrichedDomains.forEach(d => {
      const key = d.serverName;
      (map[key] = map[key] ?? []).push(d);
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [enrichedDomains]);

  const handleImport = async () => {
    if (!csvContent.trim()) return;
    setSaving(true);
    try {
      // Empty serverId support is assumed to be handled by backend/useDB
      await importDomains('', csvContent.trim());
      showToast('Domains imported successfully');
      setDrawerOpen(false);
      setCsvContent('');
    } catch (err: any) {
      showToast(err.message || 'Error importing domains', true);
    }
    setSaving(false);
  };

  // stats summary
  const totalDomains = enrichedDomains.length;
  const excellent = enrichedDomains.filter(d => d.score >= 80).length;
  const atRisk = enrichedDomains.filter(d => d.score < 55).length;
  const avgScore = totalDomains > 0 ? Math.round(enrichedDomains.reduce((s, d) => s + d.score, 0) / totalDomains) : 0;

  const HEALTH_FILTERS = [
    { label: 'Tous', val: 'all' },
    { label: 'Excellent', val: 'excellent' },
    { label: 'Bon', val: 'good' },
    { label: 'À Risque', val: 'risk' },
    { label: 'Critique', val: 'critical' },
  ];

  return (
    <ScreenContainer title="Domaines" subtitle={`${totalDomains} domaines actifs`}>
      {/* Stats row & Add button */}
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="kt-card px-4 py-3 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-success opacity-60" />
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1">Excellents</div>
            <div className="text-2xl font-bold text-foreground">{excellent}</div>
            <div className="text-[10px] text-success font-bold">{totalDomains > 0 ? Math.round((excellent / totalDomains) * 100) : 0}%</div>
          </div>
          <div className="kt-card px-4 py-3 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-warning opacity-60" />
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1">À Risque</div>
            <div className="text-2xl font-bold text-foreground">{atRisk}</div>
            <div className="text-[10px] text-warning font-bold">Score moy: {avgScore}</div>
          </div>
        </div>

        <button 
          onClick={() => setDrawerOpen(true)}
          className="btn-primary justify-center gap-2 h-11"
        >
          <span>🌐</span>
          <span>Ajouter de nouveaux domaines</span>
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground opacity-50 text-sm">🔍</span>
        <input
          value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder="Rechercher un domaine..."
          className="w-full bg-muted/40 border border-border/50 rounded-2xl pl-10 pr-4 h-11 text-sm font-medium text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10 transition-all"
        />
      </div>

      {/* Health filter pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
        {HEALTH_FILTERS.map(f => (
          <button
            key={f.val}
            onClick={() => setHealthFilter(f.val)}
            className={`shrink-0 text-[10px] font-black uppercase tracking-wider px-3.5 py-2 rounded-xl transition-all ${
              healthFilter === f.val
                ? 'bg-primary text-white shadow-md shadow-primary/25'
                : 'bg-muted/50 text-muted-foreground hover:bg-muted border border-border/50'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Domain list grouped by server */}
      {enrichedDomains.length === 0 ? (
        <div className="kt-card border-dashed p-12 text-center">
          <div className="text-3xl mb-3 opacity-30">🌐</div>
          <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest">Aucun domaine trouvé</p>
        </div>
      ) : (
        groupedByServer.map(([serverName, doms]) => (
          <div key={serverName} className="space-y-2">
            <div className="flex items-center gap-3 px-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">🖥️ {serverName}</span>
              <div className="h-px flex-1 bg-border/30" />
              <span className="text-[10px] font-bold text-muted-foreground">{doms.length}</span>
            </div>

            {doms.map(d => (
              <div 
                key={d.id} 
                onClick={() => navigate(`/postmaster?domain=${d.domain}`)}
                className="kt-card p-4 hover:shadow-lg hover:border-primary/50 cursor-pointer transition-all duration-200 group relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="flex items-start gap-3 relative z-10">
                  {/* Health indicator */}
                  <div className="shrink-0 mt-0.5">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-xs font-black shadow-md"
                      style={{ backgroundColor: d.scoreColor }}
                    >
                      {d.score}
                    </div>
                  </div>

                  {/* Domain info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-bold text-foreground truncate">{d.domain}</span>
                      <span
                        className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg shrink-0"
                        style={{
                          backgroundColor: d.scoreColor + '20',
                          color: d.scoreColor,
                        }}
                      >
                        {d.scoreLabel}
                      </span>
                    </div>

                    {/* Stats row */}
                    <div className="flex items-center gap-4 text-[10px] text-muted-foreground font-bold">
                      <span>{d.ipCount} IPs</span>
                      <span>·</span>
                      <span className={d.status === 'inbox' ? 'text-success' : d.status === 'spam' ? 'text-warning' : 'text-destructive'}>
                        {d.status === 'inbox' ? '📥 Inbox' : d.status === 'spam' ? '⚠️ Spam' : '🚫 Bloqué'}
                      </span>
                      {d.warmupIps > 0 && (
                        <>
                          <span>·</span>
                          <span className="text-primary">🔥 {d.warmupIps} warmup</span>
                        </>
                      )}
                    </div>

                    {/* Reputation bar */}
                    <div className="mt-2.5">
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${d.score}%`, backgroundColor: d.scoreColor }}
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div className="shrink-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-muted-foreground text-lg">→</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))
      )}

      {/* Import Drawer */}
      <Drawer 
        open={drawerOpen} 
        onClose={() => setDrawerOpen(false)} 
        title="Ajouter des domaines"
        subtitle="Importez des domaines sans les assigner à un serveur"
      >
        <DField label="Format CSV (domain,ip,provider...)" required>
          <textarea
            value={csvContent}
            onChange={e => setCsvContent(e.target.value)}
            placeholder="domain.com,1.2.3.4,Namecheap,inbox"
            className="field-input w-full min-h-[200px] font-mono text-xs p-4"
          />
        </DField>
        
        <p className="text-[11px] text-muted-foreground leading-relaxed mb-6">
          Vous pouvez importer plusieurs domaines à la fois. Si aucun serveur n'est spécifié, ils seront listés dans "Non assigné".
        </p>

        <DFooter 
          onCancel={() => setDrawerOpen(false)}
          onSave={handleImport}
          saving={saving}
          disabled={!csvContent.trim()}
          saveLabel="Importer les domaines"
        />
      </Drawer>
    </ScreenContainer>
  );
}
