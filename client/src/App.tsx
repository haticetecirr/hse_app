import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { PendingPage } from './pages/PendingPage';
import { DashboardPage } from './pages/DashboardPage';
import { ReportsListPage } from './pages/ReportsListPage';
import { ReportDetailPage } from './pages/ReportDetailPage';
import { AccidentFormPage } from './pages/AccidentFormPage';
import { NearMissFormPage } from './pages/NearMissFormPage';
import { AdminUsersPage } from './pages/AdminUsersPage';
import { AdminRolesPage } from './pages/AdminRolesPage';
import { AdminDepartmentsPage } from './pages/AdminDepartmentsPage';
import { AdminAuditPage } from './pages/AdminAuditPage';

export function App() {
  const { me, loading } = useAuth();

  if (loading) {
    return (
      <div className="auth-wrap">
        <div style={{ color: '#fff' }}>Yukleniyor...</div>
      </div>
    );
  }

  // Giris yapilmamis
  if (!me) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  // Onay bekleyen / reddedilen kullanicilar
  if (me.status !== 'VERIFIED') {
    return (
      <Routes>
        <Route path="*" element={<PendingPage />} />
      </Routes>
    );
  }

  // Onayli kullanicilar - tam uygulama
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/reports" element={<ReportsListPage />} />
        <Route path="/reports/:id" element={<ReportDetailPage />} />
        <Route path="/reports/new/accident" element={<AccidentFormPage />} />
        <Route path="/reports/new/near-miss" element={<NearMissFormPage />} />
        <Route path="/admin/users" element={<AdminUsersPage />} />
        <Route path="/admin/roles" element={<AdminRolesPage />} />
        <Route path="/admin/departments" element={<AdminDepartmentsPage />} />
        <Route path="/admin/audit" element={<AdminAuditPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
