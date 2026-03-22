import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppContext } from '../App';
import { 
  ArrowLeft, CheckCircle2, AlertCircle, Clock, 
  ShieldCheck, ShieldAlert, Shield, BarChart3,
  Search, Info, Save, Beaker
} from 'lucide-react';

function formatDateTime(value: Date) {
  return value.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function TestSeedEvaluationView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { 
    testSeeds, testSeedItems, deliveries, servers, domains, ips,
    createTestSeedEvaluation, updateTestSeed, showToast
  } = useAppContext();

  const testSeed = testSeeds.find(s => s.id === id);
  const delivery = deliveries.find(d => d.id === testSeed?.delivery_id);
  const server = servers.find(s => s.id === testSeed?.server_id);
  const domain = domains.find(d => d.id === testSeed?.domain_id);
  const ip = ips.find(i => i.id === testSeed?.ip_id);

  const [metrics, setMetrics] = useState<{
    spam_rate: 'low' | 'medium' | 'high';
    ip_reputation: 'bad' | 'medium' | 'good';
    domain_reputation: 'bad' | 'medium' | 'good';
    feedback_loop: 'yes' | 'no';
    delivery_errors: 'low' | 'medium' | 'high';
  }>({
    spam_rate: 'low',
    ip_reputation: 'good',
    domain_reputation: 'good',
    feedback_loop: 'no',
    delivery_errors: 'low'
  });

  if (!testSeed) {
    return (
      <div className="p-8 text-center">
        <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
        <h2 className="text-xl font-bold">Test Not Found</h2>
        <button onClick={() => navigate('/test-seed')} className="mt-4 text-primary hover:underline">
          Back to list
        </button>
      </div>
    );
  }

  // 48-hour guard logic
  const createdAt = new Date(testSeed.created_at);
  const evaluationAvailableAt = new Date(createdAt.getTime() + 48 * 60 * 60 * 1000);
  const isAvailable = new Date() >= evaluationAvailableAt;
  const timeRemaining = evaluationAvailableAt.getTime() - new Date().getTime();
  const hoursRemaining = Math.max(0, Math.ceil(timeRemaining / (1000 * 60 * 60)));

  useEffect(() => {
    if (!isAvailable) {
      showToast({
        type: 'info',
        message: 'Results will be available after 48 hours',
        description: `This test can be finalized in about ${hoursRemaining} hour${hoursRemaining === 1 ? '' : 's'}.`,
      });
    }
  }, [hoursRemaining, isAvailable, showToast]);

  const handleSave = async () => {
    try {
      // Deterministic Decision Engine (Rule G)
      let result: 'good' | 'bad' = 'good';
      let reason = "All metrics passed within safe thresholds.";

      if (metrics.spam_rate === 'high' || metrics.ip_reputation === 'bad' || metrics.domain_reputation === 'bad') {
        result = 'bad';
        reason = "Critical reputation or spam rate failure.";
      } else if (metrics.delivery_errors === 'high' || metrics.feedback_loop === 'yes') {
        result = 'bad';
        reason = "High delivery errors or feedback loop alerts.";
      }

      await createTestSeedEvaluation({
        test_seed_id: testSeed.id,
        ...metrics,
        final_result: result,
        decision_reason: reason,
        evaluated_at: new Date().toISOString()
      });

      await updateTestSeed(testSeed.id, { 
        status: result === 'good' ? 'completed' : 'failed' 
      });

      showToast({
        type: 'success',
        message: `Evaluation completed: ${result.toUpperCase()}`,
      });
      navigate('/test-seed');
    } catch (err) {
      showToast({ type: 'error', message: 'Unable to save changes' });
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-8">
        <button 
          onClick={() => navigate('/test-seed')}
          className="p-2 hover:bg-secondary rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Test Evaluation</h1>
          <p className="text-muted-foreground flex items-center gap-2">
            <Beaker className="w-4 h-4" />
            {delivery?.name} • {domain?.domain}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-secondary/30 p-4 rounded-xl border border-border">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Infrastructure</p>
          <p className="font-semibold">{server?.name}</p>
          <p className="text-sm text-muted-foreground">{ip?.ip}</p>
        </div>
        <div className="bg-secondary/30 p-4 rounded-xl border border-border">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Started At</p>
          <p className="font-semibold">{formatDateTime(createdAt)}</p>
        </div>
        <div className="bg-secondary/30 p-4 rounded-xl border border-border">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Evaluation Status</p>
          {isAvailable ? (
            <div className="flex items-center gap-2 text-green-500 font-semibold">
              <CheckCircle2 className="w-4 h-4" /> Ready for Decision
            </div>
          ) : (
            <div className="flex items-center gap-2 text-amber-500 font-semibold">
              <Clock className="w-4 h-4" /> Available in {hoursRemaining}h
            </div>
          )}
        </div>
      </div>

      {!isAvailable && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mb-8 flex gap-4">
          <AlertCircle className="w-6 h-6 text-amber-500 shrink-0" />
          <div>
            <p className="font-semibold text-amber-500">Wait 48 Hours Before Finalizing</p>
            <p className="text-sm text-amber-500/80">
              Deliverability results can fluctuate during the first 48 hours. Please wait until the cooldown period ends to enter metrics and make a final decision.
            </p>
          </div>
        </div>
      )}

      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
        <div className="p-6 border-b border-border">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            Step 3: Manual Metric Ingestion
          </h2>
          <p className="text-sm text-muted-foreground mt-1">Enter the metrics observed from your warm-up and testing period.</p>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold">Spam Rate (Google Postmaster)</label>
              <select 
                className="w-full bg-secondary/50 border border-border rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-primary/20"
                value={metrics.spam_rate}
                onChange={e => setMetrics(prev => ({ ...prev, spam_rate: e.target.value as any }))}
                disabled={!isAvailable}
              >
                <option value="low">Low (0-0.1%)</option>
                <option value="medium">Medium (0.1-0.3%)</option>
                <option value="high">High (&gt;0.3%)</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold">IP Reputation</label>
              <select 
                className="w-full bg-secondary/50 border border-border rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-primary/20"
                value={metrics.ip_reputation}
                onChange={e => setMetrics(prev => ({ ...prev, ip_reputation: e.target.value as any }))}
                disabled={!isAvailable}
              >
                <option value="good">Good / High</option>
                <option value="medium">Medium</option>
                <option value="bad">Bad / Low</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold">Domain Reputation</label>
              <select 
                className="w-full bg-secondary/50 border border-border rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-primary/20"
                value={metrics.domain_reputation}
                onChange={e => setMetrics(prev => ({ ...prev, domain_reputation: e.target.value as any }))}
                disabled={!isAvailable}
              >
                <option value="good">Good / High</option>
                <option value="medium">Medium</option>
                <option value="bad">Bad / Low</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold">Feedback Loop (FBL) Alerts</label>
              <select 
                className="w-full bg-secondary/50 border border-border rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-primary/20"
                value={metrics.feedback_loop}
                onChange={e => setMetrics(prev => ({ ...prev, feedback_loop: e.target.value as any }))}
                disabled={!isAvailable}
              >
                <option value="no">No Alerts</option>
                <option value="yes">Alerts Received</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold">Generic Delivery Errors</label>
              <select 
                className="w-full bg-secondary/50 border border-border rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-primary/20"
                value={metrics.delivery_errors}
                onChange={e => setMetrics(prev => ({ ...prev, delivery_errors: e.target.value as any }))}
                disabled={!isAvailable}
              >
                <option value="low">Low / None</option>
                <option value="medium">Moderate</option>
                <option value="high">High / Blocking</option>
              </select>
            </div>
          </div>

          <div className="pt-6 border-t border-border flex justify-between items-center">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Info className="w-4 h-4" />
              Decision logic is deterministic based on thresholds.
            </div>
            <button
              onClick={handleSave}
              disabled={!isAvailable}
              className="flex items-center gap-2 bg-primary text-primary-foreground px-6 py-2.5 rounded-xl font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              Finalize Decision
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
