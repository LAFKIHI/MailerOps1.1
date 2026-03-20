import { useEffect, useState } from 'react';
import { useAppContext } from '../App';

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
  const { login } = useAppContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Listen for OAuth token from main process
    const handleToken = (event: any, data: any) => {
      console.log('Received token data in renderer:', data);
      setLoading(false);
      if (data.error) {
        setError(data.error);
        return;
      }
      const { access_token, id_token } = data;
      if (!id_token) {
        setError('No id_token received');
        return;
      }
      const profile = decodeJwt<{ email?: string; sub?: string }>(id_token);
      if (!profile?.email || !profile?.sub) {
        setError('Failed to read Google profile');
        return;
      }
      // Save Postmaster token
      const pmToken = { access_token, expires_at: Date.now() + (data.expires_in || 3600) * 1000 };
      localStorage.setItem('pm_token_v2_' + profile.sub, JSON.stringify(pmToken));
      login(profile.email, profile.sub).catch(e => setError(e.message));
    };

    (window as any).electron?.ipcRenderer?.on('oauth-token', handleToken);
    return () => {
      (window as any).electron?.ipcRenderer?.removeListener('oauth-token', handleToken);
    };
  }, [login]);

  const handleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      await (window as any).electron.ipcRenderer.invoke('start-oauth');
    } catch (e: any) {
      setError(e.message || 'Failed to start OAuth');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0d0f11] flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-[#131619] border border-[#252b32] rounded-xl p-8 text-center shadow-2xl">
        <div className="text-[#4df0a0] text-5xl mb-4">⬡</div>
        <h1 className="font-['Syne',sans-serif] font-extrabold text-[#e2e8f0] text-2xl tracking-wide mb-1">
          MAILER<span className="text-[#4df0a0]">OPS</span>
        </h1>
        <p className="text-[#5a6478] text-sm font-mono mb-8">Seed & Server Infrastructure Manager</p>

        <div className="text-[#5a6478] text-xs font-mono mb-4">
          Sign in with your Google account to access Postmaster Tools data.
        </div>

        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 bg-[#1a1e22] border border-[#2e3540] rounded-lg px-4 py-3
            text-[#e2e8f0] text-sm font-mono hover:border-[#4df0a0] hover:text-[#4df0a0] transition-all disabled:opacity-50"
        >
          {loading ? 'Signing in…' : 'Continue with Google'}
        </button>

        {error && <p className="mt-4 text-[#f04d4d] text-xs font-mono">{error}</p>}
      </div>
    </div>
  );
}
