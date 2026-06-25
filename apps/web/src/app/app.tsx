import { Link, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { RequireAuth } from '../components/RequireAuth';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { Dashboard } from '../pages/Dashboard';
import { PortfolioDetail } from '../pages/PortfolioDetail';
import { Login } from '../pages/Login';
import { Register } from '../pages/Register';

function Header() {
  const { token, user, logout } = useAuthStore();
  const navigate = useNavigate();

  return (
    <header className="border-b bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link to="/" className="text-xl font-semibold">
          Investment Tracker
        </Link>
        {token && (
          <div className="flex items-center gap-4 text-sm">
            <span className="text-gray-500">{user?.email}</span>
            <button
              className="rounded border px-3 py-1 hover:bg-gray-50"
              onClick={() => {
                logout();
                navigate('/login');
              }}
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

export function App() {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <Header />
      <main className="mx-auto max-w-5xl p-6">
        <ErrorBoundary>
        <Routes>
          <Route
            path="/"
            element={
              <RequireAuth>
                <Dashboard />
              </RequireAuth>
            }
          />
          <Route
            path="/portfolios/:id"
            element={
              <RequireAuth>
                <PortfolioDetail />
              </RequireAuth>
            }
          />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </ErrorBoundary>
      </main>
    </div>
  );
}

export default App;
