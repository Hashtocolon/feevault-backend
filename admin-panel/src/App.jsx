import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import Layout from './components/Layout/Layout';
import Login from './pages/Login';
import Overview from './pages/Overview';
import Schools from './pages/Schools';
import Parents from './pages/Parents';
import EscrowMonitor from './pages/EscrowMonitor';
import Reconciliation from './pages/Reconciliation';
import PayoutBatches from './pages/PayoutBatches';
import Documents from './pages/Documents';
import Exceptions from './pages/Exceptions';
import Finance from './pages/Finance';
import AuditLogs from './pages/AuditLogs';
import Team from './pages/Team';
import Settings from './pages/Settings';

export default function App() {
  const [user, setUser] = useState({
    name: 'Vikram Anand',
    email: 'admin@feevault.in',
    role: 'SUPER_ADMIN',
  });

  const handleLogout = () => setUser(null);
  const handleLogin = (userData) => setUser(userData);

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={<Navigate to="/overview" replace />}
        />
        <Route
          path="/overview"
          element={
            <Layout user={user} onLogout={handleLogout} title="Operations Overview" subtitle="Multi-Bank Pooled Escrow & Ledger Monitor">
              <Overview />
            </Layout>
          }
        />
        <Route
          path="/schools"
          element={
            <Layout user={user} onLogout={handleLogout} title="Partner Schools" subtitle="Onboarding & Fee Schedule Configuration">
              <Schools />
            </Layout>
          }
        />
        <Route
          path="/parents"
          element={
            <Layout user={user} onLogout={handleLogout} title="Parents & Vaults" subtitle="KYC Status & Device Authorization">
              <Parents />
            </Layout>
          }
        />
        <Route
          path="/escrow"
          element={
            <Layout user={user} onLogout={handleLogout} title="Escrow Monitor" subtitle="ICICI Pooled Account & Composition">
              <EscrowMonitor />
            </Layout>
          }
        />
        <Route
          path="/reconciliation"
          element={
            <Layout user={user} onLogout={handleLogout} title="3-Way Reconciliation" subtitle="Internal Ledger ⇄ Bank Statement ⇄ Escrow Vault">
              <Reconciliation />
            </Layout>
          }
        />
        <Route
          path="/payouts"
          element={
            <Layout user={user} onLogout={handleLogout} title="Payout Batches" subtitle="Dual-Authorization Maker-Checker Disbursements">
              <PayoutBatches />
            </Layout>
          }
        />
        <Route
          path="/documents"
          element={
            <Layout user={user} onLogout={handleLogout} title="School Documents" subtitle="MoUs, Bank Mandates & Confirmation Receipts">
              <Documents />
            </Layout>
          }
        />
        <Route
          path="/exceptions"
          element={
            <Layout user={user} onLogout={handleLogout} title="Exception Requests" subtitle="Refunds, Early Withdrawals & SLA Resolution">
              <Exceptions />
            </Layout>
          }
        />
        <Route
          path="/finance"
          element={
            <Layout user={user} onLogout={handleLogout} title="Finance & GST" subtitle="Platform Revenue, GSTR-1 & Form 16A TDS">
              <Finance />
            </Layout>
          }
        />
        <Route
          path="/audit"
          element={
            <Layout user={user} onLogout={handleLogout} title="Audit Logs" subtitle="Tamper-Evident Immutable System Audit Trail">
              <AuditLogs />
            </Layout>
          }
        />
        <Route
          path="/team"
          element={
            <Layout user={user} onLogout={handleLogout} title="Team & Roles" subtitle="RBAC Permission Tiers & Staff Management">
              <Team />
            </Layout>
          }
        />
        <Route
          path="/settings"
          element={
            <Layout user={user} onLogout={handleLogout} title="System Settings" subtitle="Commission Rules, GST Thresholds & Security Controls">
              <Settings />
            </Layout>
          }
        />
        <Route path="*" element={<Navigate to="/overview" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
