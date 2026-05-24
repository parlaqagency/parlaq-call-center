import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import axios from 'axios';
import Sidebar from './components/Layout/Sidebar';
import Header from './components/Layout/Header';
import Dashboard from './pages/Dashboard';
import Calls from './pages/Calls';
import Agents from './pages/Agents';
import Reports from './pages/Reports';
import Customers from './pages/Customers';
import Login from './pages/Login';
import SetupAdmin from './pages/SetupAdmin';
import AgentWorkspace from './pages/AgentWorkspace';
import Appointments from './pages/Appointments';
import Campaigns from './pages/Campaigns';
import IncomingCallAlert from './components/IncomingCallAlert';
import SoftphoneWidget from './components/SoftphoneWidget';
import ToastContainer from './components/Toast';
import { useSocket } from './hooks/useSocket';
import { useAuthStore } from './store/authStore';
import { useSipStore } from './store/sipStore';

const PAGE_TITLES = {
  '/dashboard': 'Dashboard',
  '/calls': 'Çağrılar',
  '/customers': 'Müşteriler',
  '/agents': 'Çalışanlar',
  '/reports': 'Raporlar',
  '/appointments': 'Randevular',
  '/campaigns': 'Kampanyalar',
};

function InitialAppLoader() {
  return (
    <div className="fixed inset-0 bg-white flex flex-col items-center justify-center z-[9999]">
      <div className="flex flex-col items-center gap-5">
        <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center">
          <span className="text-white font-bold text-lg tracking-tight">P</span>
        </div>
        <div className="w-40 h-0.5 bg-slate-100 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-slate-800 rounded-full"
            initial={{ x: '-100%' }}
            animate={{ x: '100%' }}
            transition={{ duration: 1.1, ease: 'easeInOut', repeat: Infinity }}
          />
        </div>
      </div>
    </div>
  );
}

function AdminRoute({ children }) {
  const agent = useAuthStore(s => s.agent);
  const isAdmin = useAuthStore(s => s.isAdmin);
  const isInitialLoading = useAuthStore(s => s.isInitialLoading);
  const location = useLocation();

  if (isInitialLoading) return <InitialAppLoader />;
  if (!agent) return <Navigate to="/login" state={{ from: location }} replace />;
  if (!isAdmin) return <Navigate to="/agent" replace />;
  return children;
}

function AgentRoute({ children }) {
  const agent = useAuthStore(s => s.agent);
  const isAdmin = useAuthStore(s => s.isAdmin);
  const isInitialLoading = useAuthStore(s => s.isInitialLoading);
  const location = useLocation();

  if (isInitialLoading) return <InitialAppLoader />;
  if (!agent) return <Navigate to="/login" state={{ from: location }} replace />;
  if (isAdmin) return <Navigate to="/dashboard" replace />;
  return children;
}

function AdminLayout({ children, path }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Mobile overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-black/40 z-40 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar: fixed drawer on mobile, static on desktop */}
      <div className={`
        fixed md:static inset-y-0 left-0 z-50 h-full
        transition-transform duration-200 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </div>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header title={PAGE_TITLES[path] || 'Parlaq'} onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}

function AppInner() {
  useSocket();
  const agent               = useAuthStore(s => s.agent);
  const token               = useAuthStore(s => s.token);
  const setIsInitialLoading = useAuthStore(s => s.setIsInitialLoading);
  const initSip             = useSipStore(s => s.init);
  const destroySip          = useSipStore(s => s.destroy);

  // Silent auth verification on every mount (page refresh)
  useEffect(() => {
    const verify = async () => {
      setIsInitialLoading(true);
      try {
        if (token) {
          const { data } = await axios.get('/api/auth/me');
          useAuthStore.setState({ agent: data, isAdmin: data.role === 'admin' });
          if (data.sip_password) initSip(data);
        }
      } catch (err) {
        if (err.response?.status === 401) {
          useAuthStore.getState().logout();
        }
        // Network/server errors: keep stored session, don't logout
      } finally {
        setIsInitialLoading(false);
      }
    };
    verify();
  }, []);

  useEffect(() => {
    if (!agent) destroySip();
  }, [agent?.id]);

  return (
    <>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/setup" element={<SetupAdmin />} />

        {/* Root redirect based on role */}
        <Route path="/" element={
          agent
            ? (agent.role === 'admin' ? <Navigate to="/dashboard" replace /> : <Navigate to="/agent" replace />)
            : <Navigate to="/login" replace />
        } />

        {/* Agent workspace */}
        <Route path="/agent" element={
          <AgentRoute><AgentWorkspace /></AgentRoute>
        } />

        {/* Admin panel */}
        <Route path="/dashboard" element={
          <AdminRoute><AdminLayout path="/dashboard"><Dashboard /></AdminLayout></AdminRoute>
        } />
        <Route path="/calls" element={
          <AdminRoute><AdminLayout path="/calls"><Calls /></AdminLayout></AdminRoute>
        } />
        <Route path="/customers" element={
          <AdminRoute><AdminLayout path="/customers"><Customers /></AdminLayout></AdminRoute>
        } />
        <Route path="/agents" element={
          <AdminRoute><AdminLayout path="/agents"><Agents /></AdminLayout></AdminRoute>
        } />
        <Route path="/reports" element={
          <AdminRoute><AdminLayout path="/reports"><Reports /></AdminLayout></AdminRoute>
        } />
        <Route path="/appointments" element={
          <AdminRoute><AdminLayout path="/appointments"><Appointments /></AdminLayout></AdminRoute>
        } />
        <Route path="/campaigns" element={
          <AdminRoute><AdminLayout path="/campaigns"><Campaigns /></AdminLayout></AdminRoute>
        } />
      </Routes>

      {/* Hidden audio element for SIP remote stream */}
      <audio id="sip-remote-audio" autoPlay playsInline style={{ display: 'none' }} />

      {agent && <IncomingCallAlert />}
      {agent && <SoftphoneWidget />}
      <ToastContainer />
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppInner />
    </BrowserRouter>
  );
}
