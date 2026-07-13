import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import LinhaBalaPage from './pages/LinhaBalancoPage';
import ImportacaoPage from './pages/ImportacaoPage';
import CronogramaPage from './pages/CronogramaPage';
import OrcamentoPage from './pages/OrcamentoPage';
import ContratacaoPage from './pages/ContratacaoPage';
import UsuariosPage from './pages/UsuariosPage';

function PrivateRoute({ children, perfis }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (perfis && !perfis.includes(user.perfil)) return <Navigate to="/" replace />;
  return children;
}

function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="linha-balanco" element={<LinhaBalaPage />} />
        <Route path="cronograma" element={<CronogramaPage />} />
        <Route path="orcamento" element={<OrcamentoPage />} />
        <Route path="contratacoes" element={<ContratacaoPage />} />
        <Route
          path="importacao"
          element={
            <PrivateRoute perfis={['gestor', 'admin']}>
              <ImportacaoPage />
            </PrivateRoute>
          }
        />
        <Route
          path="usuarios"
          element={
            <PrivateRoute perfis={['gestor', 'admin']}>
              <UsuariosPage />
            </PrivateRoute>
          }
        />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
