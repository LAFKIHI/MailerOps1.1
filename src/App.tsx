import {
  createContext,
  type Dispatch,
  type SetStateAction,
  useContext,
  useEffect,
  useState,
} from 'react';

import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from 'react-router-dom';

import MobileLayout from './components/MobileLayout';
import Layout from './components/Layout';
import { Toaster } from 'sonner';
import { ConfirmProvider } from './hooks/useConfirm';
import { useDB } from './hooks/useDB';
import { useToast, type ShowToastInput } from './hooks/useToast';
import BulkDomains from './views/BulkDomains';
import PostmasterView from './views/Postmaster';
import Deliveries from './views/Deliveries';
import DeliveryDetail from './views/DeliveryDetail';
import DeliveryRdpSummary from './views/DeliveryRdpSummary';
import History from './views/History';
import Home from './views/Home';
import LoginPage from './views/LoginPage';
import SeedTasks from './views/SeedTasks';
import ServerDetail from './views/ServerDetail';
import Servers from './views/Servers';
import Settings from './views/Settings';
import DomainesView from './views/DomainesView';
import AnalyticsView from './views/AnalyticsView';
import Dashboard from './views/Dashboard';
import TestSeedView from './views/TestSeedView';
import TestSeedEvaluationView from './views/TestSeedEvaluationView';

export type AppContextType = ReturnType<typeof useDB> & {
  showToast: (input: ShowToastInput, err?: boolean) => void;
  selectedServers: string[];
  setSelectedServers: Dispatch<SetStateAction<string[]>>;
  clearSelectedServers: () => void;
  toggleSelectedServer: (serverId: string) => void;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const AppContext = createContext<AppContextType>(null as any);
export const useAppContext = () => useContext(AppContext);

export default function App() {
  const db = useDB();
  const { showToast } = useToast();
  const [selectedServers, setSelectedServers] = useState<string[]>([]);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    setSelectedServers(prev => prev.filter(id => db.servers.some(server => server.id === id)));
  }, [db.servers]);

  const clearSelectedServers = () => {
    setSelectedServers([]);
  };

  const toggleSelectedServer = (serverId: string) => {
    setSelectedServers(prev => (
      prev.includes(serverId)
        ? prev.filter(id => id !== serverId)
        : [...prev, serverId]
    ));
  };

  return (
    <AppContext.Provider
      value={{
        ...db,
        showToast,
        selectedServers,
        setSelectedServers,
        clearSelectedServers,
        toggleSelectedServer,
      }}
    >
      <ConfirmProvider>
        <BrowserRouter>
          {!db.isReady ? (
            <div className="min-h-screen bg-background flex flex-col items-center justify-center">
              <div className="relative w-24 h-24 mb-6">
                <div className="absolute inset-0 border-4 border-primary/20 rounded-2xl rotate-45 animate-pulse" />
                <div className="absolute inset-4 border-4 border-primary/40 rounded-xl -rotate-12 animate-spin duration-[3000ms]" />
                <div className="absolute inset-0 flex items-center justify-center text-3xl font-bold text-primary">
                  M
                </div>
              </div>
              <div className="text-foreground text-lg font-bold tracking-tight mb-1">MailerOps</div>
              <div className="text-muted-foreground text-xs font-bold uppercase tracking-[0.2em] animate-pulse">Initializing System</div>
            </div>
          ) : db.currentUser ? (
            isMobile ? (
              <MobileLayout>
                <Routes>
                  {/* ─── Original routes (preserved) ─── */}
                  <Route path="/"                   element={<Dashboard />} />
                  <Route path="/dashboard"          element={<Dashboard />} />
                  <Route path="/test-seed"          element={<TestSeedView />} />
                  <Route path="/test-seed/:id"      element={<TestSeedEvaluationView />} />
                  <Route path="/seed-tasks"         element={<SeedTasks />} />
                  <Route path="/bulk-domains"       element={<BulkDomains />} />
                  <Route path="/deliveries"         element={<Deliveries />} />
                  <Route path="/deliveries/rdp/:rdpId" element={<DeliveryRdpSummary />} />
                  <Route path="/deliveries/:id"     element={<DeliveryDetail />} />
                  <Route path="/servers"            element={<Servers />} />
                  <Route path="/servers/:id"        element={<ServerDetail />} />
                  <Route path="/history"            element={<History />} />
                  <Route path="/postmaster"         element={<PostmasterView />} />
                  <Route path="/settings"           element={<Settings />} />

                  {/* ─── New mobile screens ─── */}
                  <Route path="/domains"            element={<DomainesView />} />
                  <Route path="/analytics"          element={<AnalyticsView />} />

                  <Route path="*"                   element={<Navigate to="/" replace />} />
                </Routes>
              </MobileLayout>
            ) : (
              <Layout>
                <Routes>
                  {/* ─── Original routes (preserved) ─── */}
                  <Route path="/"                   element={<Dashboard />} />
                  <Route path="/dashboard"          element={<Dashboard />} />
                  <Route path="/test-seed"          element={<TestSeedView />} />
                  <Route path="/test-seed/:id"      element={<TestSeedEvaluationView />} />
                  <Route path="/seed-tasks"         element={<SeedTasks />} />
                  <Route path="/bulk-domains"       element={<BulkDomains />} />
                  <Route path="/deliveries"         element={<Deliveries />} />
                  <Route path="/deliveries/rdp/:rdpId" element={<DeliveryRdpSummary />} />
                  <Route path="/deliveries/:id"     element={<DeliveryDetail />} />
                  <Route path="/servers"            element={<Servers />} />
                  <Route path="/servers/:id"        element={<ServerDetail />} />
                  <Route path="/history"            element={<History />} />
                  <Route path="/postmaster"         element={<PostmasterView />} />
                  <Route path="/settings"           element={<Settings />} />

                  {/* ─── New mobile screens ─── */}
                  <Route path="/domains"            element={<DomainesView />} />
                  <Route path="/analytics"          element={<AnalyticsView />} />

                  <Route path="*"                   element={<Navigate to="/" replace />} />
                </Routes>
              </Layout>
            )
          ) : (
            <Routes>
              <Route path="*" element={<LoginPage />} />
            </Routes>
          )}
        </BrowserRouter>
      </ConfirmProvider>
      <Toaster position="top-right" richColors closeButton duration={4000} visibleToasts={5} />
    </AppContext.Provider>
  );
}
