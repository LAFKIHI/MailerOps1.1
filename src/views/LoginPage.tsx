'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import {
  Eye, EyeOff, Mail, Lock, ArrowRight,
  Shield, Activity, Server, Zap, CheckCircle,
  AlertCircle, Loader2,
} from 'lucide-react';

import AppLogo from '../components/ui/AppLogo';
import { useAppContext } from '../App';

// JWT Decoder
function decodeJwt<T>(token: string): T | null {
  try {
    const payload = token.split('.')[1];
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decodeURIComponent(escape(decoded))) as T;
  } catch {
    return null;
  }
}

export default function LoginPage() {
  const { login, showToast } = useAppContext();
  const [tab, setTab] = useState<'login' | 'signup'>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Handle OAuth Token from Electron
  useEffect(() => {
    const handleToken = (event: any, data: any) => {
      console.log('Received token data in renderer:', data);
      setIsLoading(false);
      if (data.error) {
        setLoginError(data.error);
        showToast({ type: 'error', message: data.error });
        return;
      }
      const { access_token, id_token } = data;
      if (!id_token) {
        setLoginError('No id_token received');
        return;
      }
      const profile = decodeJwt<{ email?: string; sub?: string }>(id_token);
      if (!profile?.email || !profile?.sub) {
        setLoginError('Failed to read Google profile');
        return;
      }
      
      // Save Postmaster token
      const pmToken = { access_token, expires_at: Date.now() + (data.expires_in || 3600) * 1000 };
      localStorage.setItem('pm_token_v2_' + profile.sub, JSON.stringify(pmToken));
      
      showToast({ type: 'success', message: 'Signed in with Google Workspace' });
      login(profile.email, profile.sub).catch(e => {
        setLoginError(e.message);
        showToast({ type: 'error', message: e.message });
      });
    };

    (window as any).electron?.ipcRenderer?.on('oauth-token', handleToken);
    return () => {
      (window as any).electron?.ipcRenderer?.removeListener('oauth-token', handleToken);
    };
  }, [login]);

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setLoginError('');
    try {
      await (window as any).electron.ipcRenderer.invoke('start-oauth');
    } catch (e: any) {
      setLoginError(e.message || 'Failed to start OAuth');
      showToast({ type: 'error', message: e.message || 'Failed to start OAuth' });
      setIsLoading(false);
    }
  };

  const infraStats = [
    { label: 'Servers Monitored', value: '2,400+', icon: Server },
    { label: 'IPs Under Warmup', value: '18,000+', icon: Activity },
    { label: 'Deliveries Tracked', value: '340M+', icon: Zap },
    { label: 'Burn Rate Prevented', value: '94.2%', icon: Shield },
  ];

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left panel — brand */}
      <div
        className="hidden lg:flex lg:w-[52%] flex-col justify-between p-12 relative overflow-hidden"
        style={{ background: 'hsl(222 22% 10%)', borderRight: '1px solid hsl(var(--border))' }}
      >
        {/* Background grid pattern */}
        <div
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: 'linear-gradient(hsl(var(--border)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border)) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
        {/* Glow */}
        <div
          className="absolute top-1/3 left-1/4 w-96 h-96 rounded-full blur-3xl opacity-10"
          style={{ background: 'hsl(var(--primary))' }}
        />

        {/* Logo */}
        <div className="relative flex items-center gap-3">
          <AppLogo size={36} />
          <span className="text-xl font-semibold text-foreground">MailerOps</span>
        </div>

        {/* Hero text */}
        <div className="relative space-y-6">
          <div>
            <h1 className="text-4xl font-bold leading-tight mb-4 text-foreground">
              Email infrastructure<br />
              <span className="text-primary text-ops-grade">ops-grade control.</span>
            </h1>
            <p className="text-base leading-relaxed text-foreground-muted">
              Monitor IP warmup schedules, detect burn risk before it happens,
              manage server fleets, and track domain reputation — all from one
              operations dashboard built for deliverability engineers.
            </p>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-3">
            {infraStats.map(({ label, value, icon: Icon }) => (
              <div
                key={label}
                className="p-4 rounded-xl bg-surface border border-border"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Icon size={14} className="text-primary" />
                  <span className="text-xs text-muted">{label}</span>
                </div>
                <p className="text-xl font-bold font-mono tabular-nums text-foreground">
                  {value}
                </p>
              </div>
            ))}
          </div>

          {/* Feature list */}
          <div className="space-y-2">
            {[
              'Shadow intelligence IP stats — auto-refreshed every 10 min',
              'Burn detection: fail_rate > 20% triggers instant alert',
              'Cascade warmup scheduling across entire server fleets',
              'Phase-based sending logs — warmup vs scale separation',
            ].map((feat) => (
              <div key={feat} className="flex items-start gap-2">
                <CheckCircle size={13} className="shrink-0 mt-0.5 text-success" />
                <span className="text-xs text-foreground-muted">{feat}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-xs text-muted">
          © 2026 MailerOps. All rights reserved.
        </p>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md animate-fade-in">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <AppLogo size={32} />
            <span className="text-lg font-semibold text-foreground">MailerOps</span>
          </div>

          {/* Tab switcher */}
          <div
            className="flex p-1 rounded-xl mb-8 bg-surface"
          >
            {(['login', 'signup'] as const).map((t) => (
              <button
                key={t}
                onClick={() => { setTab(t); setLoginError(''); }}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all duration-200 capitalize ${
                  tab === t ? 'bg-surface-elevated text-foreground shadow-lg shadow-black/20' : 'text-muted'
                }`}
              >
                {t === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            ))}
          </div>

          <div className="space-y-5">
            <div>
              <h2 className="text-2xl font-semibold mb-1 text-foreground">
                {tab === 'login' ? 'Welcome back' : 'Create your workspace'}
              </h2>
              <p className="text-sm text-muted">
                {tab === 'login' 
                  ? 'Sign in to your MailerOps workspace' 
                  : 'Start monitoring your email infrastructure today'}
              </p>
            </div>

            {/* Global error */}
            {loginError && (
              <div
                className="flex items-start gap-2 p-3 rounded-lg text-xs animate-slide-up bg-danger-bg border border-danger/30 text-danger"
              >
                <AlertCircle size={13} className="shrink-0 mt-0.5" />
                <span>{loginError}</span>
              </div>
            )}

            <div className="bg-muted/5 p-4 rounded-xl border border-border/50">
               <p className="text-xs text-foreground-muted leading-relaxed">
                 Authenticate with your corporate <strong>Google Workspace</strong> to access operational data and system controls.
               </p>
            </div>

            {/* Google Authentication Button */}
            <button
               onClick={handleGoogleLogin}
               disabled={isLoading}
               className="btn-primary w-full justify-center h-12 gap-3 text-sm font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
               {isLoading ? (
                  <Loader2 size={18} className="animate-spin text-background" />
               ) : (
                  <>
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.28.81-.56z" />
                      <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    Continue with Google Workspace
                  </>
               )}
            </button>

            <div className="relative my-8">
               <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border"></div>
               </div>
               <div className="relative flex justify-center text-[10px] uppercase tracking-widest px-2 bg-background text-muted">
                  Or use corporate credentials
               </div>
            </div>

            <div className="opacity-50 pointer-events-none grayscale">
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium mb-1.5 text-foreground-muted">Email address</label>
                    <div className="relative">
                       <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                       <input type="email" className="input pl-10" placeholder="r.kapoor@mailerops.io" readOnly />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5 text-foreground-muted">Password</label>
                    <div className="relative">
                       <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                       <input type="password" className="input pl-10 pr-10" placeholder="••••••••" readOnly />
                    </div>
                  </div>
                </div>
            </div>

            <p className="text-xs text-center text-muted">
              {tab === 'login' ? (
                <>
                  No account yet?{' '}
                  <button type="button" onClick={() => setTab('signup')} className="font-medium text-primary hover:underline">
                    Contact workspace admin
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{' '}
                  <button type="button" onClick={() => setTab('login')} className="font-medium text-primary hover:underline">
                    Sign in here
                  </button>
                </>
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
