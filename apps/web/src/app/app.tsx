import { Navigate, Route, Routes } from 'react-router-dom';
import { Dashboard } from '../pages/Dashboard';
import { PortfolioDetail } from '../pages/PortfolioDetail';
import { Login } from '../pages/Login';

export function App() {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="border-b bg-white px-6 py-4">
        <h1 className="text-xl font-semibold">Investment Tracker</h1>
      </header>
      <main className="mx-auto max-w-5xl p-6">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/portfolios/:id" element={<PortfolioDetail />} />
          <Route path="/login" element={<Login />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
