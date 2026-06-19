import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { usePortfolioStore } from '../stores/portfolioStore';
import { PnLChart } from '../components/charts/PnLChart';
import { AllocationChart } from '../components/charts/AllocationChart';

// Placeholder data until the API endpoints are wired up.
const samplePnL = [
  { date: 'Jan', value: 10000 },
  { date: 'Feb', value: 10800 },
  { date: 'Mar', value: 10400 },
  { date: 'Apr', value: 11600 },
];

const sampleAllocation = [
  { name: 'Equities', value: 60 },
  { name: 'Crypto', value: 25 },
  { name: 'Cash', value: 15 },
];

export function Dashboard() {
  const { portfolios, loading, error, fetchPortfolios } = usePortfolioStore();

  useEffect(() => {
    fetchPortfolios();
  }, [fetchPortfolios]);

  return (
    <div className="space-y-6">
      <section className="grid gap-6 md:grid-cols-2">
        <div className="rounded-lg border bg-white p-4">
          <h2 className="mb-2 font-medium">Portfolio Value</h2>
          <PnLChart data={samplePnL} />
        </div>
        <div className="rounded-lg border bg-white p-4">
          <h2 className="mb-2 font-medium">Allocation</h2>
          <AllocationChart data={sampleAllocation} />
        </div>
      </section>

      <section className="rounded-lg border bg-white p-4">
        <h2 className="mb-3 font-medium">Your Portfolios</h2>
        {loading && <p className="text-sm text-gray-500">Loading…</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
        {!loading && !error && portfolios.length === 0 && (
          <p className="text-sm text-gray-500">
            No portfolios yet. (API not connected — add one once the backend is
            running.)
          </p>
        )}
        <ul className="divide-y">
          {portfolios.map((p) => (
            <li key={p.id} className="py-2">
              <Link className="text-blue-600 hover:underline" to={`/portfolios/${p.id}`}>
                {p.name}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
