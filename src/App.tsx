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

import Layout from './components/Layout';
import Toast from './components/Toast';
import { useConfirm, ConfirmProvider } from './hooks/useConfirm';
import { useDB } from './hooks/useDB';
import { useToast } from './hooks/useToast';
import BulkDomains from './views/BulkDomains';
import PostmasterView from './views/Postmaster';
import Dashboard from './views/Dashboard';
import Deliveries from './views/Deliveries';
import DeliveryDetail from './views/DeliveryDetail';
import DeliveryRdpSummary from './views/DeliveryRdpSummary';
import History from './views/History';
import Home from './views/Home';
import LoginPage from './views/LoginPage';
import ServerDetail from './views/ServerDetail';
import Servers from './views/Servers';
import Settings from './views/Settings';

export type AppContextType = ReturnType<typeof useDB> & {
  showToast: (msg: string, err?: boolean) => void;
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
  const { toast, showToast } = useToast();
  const [selectedServers, setSelectedServers] = useState<string[]>([]);

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
          <div className="min-h-screen bg-[#0d0f11] flex items-center justify-center">
            <div className="text-center">
              <div className="text-[#4df0a0] text-5xl mb-4 animate-pulse">⬡</div>
              <div className="text-[#5a6478] text-sm font-mono">Loading MailerOps…</div>
            </div>
          </div>
        ) : db.currentUser ? (
          <Layout>
            <Routes>
              <Route path="/"                   element={<Home />} />
              <Route path="/dashboard"          element={<Dashboard />} />
              <Route path="/bulk-domains"       element={<BulkDomains />} />
              <Route path="/deliveries"         element={<Deliveries />} />
              <Route path="/deliveries/rdp/:rdpId" element={<DeliveryRdpSummary />} />
              <Route path="/deliveries/:id"     element={<DeliveryDetail />} />
              <Route path="/servers"            element={<Servers />} />
              <Route path="/servers/:id"        element={<ServerDetail />} />
              <Route path="/history"            element={<History />} />
              <Route path="/postmaster"         element={<PostmasterView />} />
              <Route path="/settings"           element={<Settings />} />
              <Route path="*"                   element={<Navigate to="/" replace />} />
            </Routes>
          </Layout>
        ) : (
          <Routes>
            <Route path="*" element={<LoginPage />} />
          </Routes>
          )}
        </BrowserRouter>
      </ConfirmProvider>
      {toast && <Toast msg={toast.msg} error={toast.error} />}
    </AppContext.Provider>
  );
}
