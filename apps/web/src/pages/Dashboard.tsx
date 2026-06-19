import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePortfolioStore } from '../stores/portfolioStore';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'INR', 'JPY'];

export function Dashboard() {
  const {
    portfolios,
    loading,
    error,
    fetchPortfolios,
    createPortfolio,
    deletePortfolio,
  } = usePortfolioStore();

  const [name, setName] = useState('');
  const [baseCurrency, setBaseCurrency] = useState('USD');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    fetchPortfolios();
  }, [fetchPortfolios]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setFormError(null);
    try {
      await createPortfolio({ name: name.trim(), baseCurrency });
      setName('');
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border bg-white p-4">
        <h2 className="mb-3 font-medium">New portfolio</h2>
        <form onSubmit={onCreate} className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col text-sm">
            <span className="mb-1 text-gray-600">Name</span>
            <input
              className="rounded border px-3 py-2"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Retirement"
            />
          </label>
          <label className="flex flex-col text-sm">
            <span className="mb-1 text-gray-600">Base currency</span>
            <select
              className="rounded border px-3 py-2"
              value={baseCurrency}
              onChange={(e) => setBaseCurrency(e.target.value)}
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            disabled={submitting}
            className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? 'Creating…' : 'Create'}
          </button>
        </form>
        {formError && <p className="mt-2 text-sm text-red-600">{formError}</p>}
      </section>

      <section className="rounded-lg border bg-white p-4">
        <h2 className="mb-3 font-medium">Your portfolios</h2>
        {loading && <p className="text-sm text-gray-500">Loading…</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
        {!loading && !error && portfolios.length === 0 && (
          <p className="text-sm text-gray-500">
            No portfolios yet — create one above.
          </p>
        )}
        <ul className="divide-y">
          {portfolios.map((p) => (
            <li key={p.id} className="flex items-center justify-between py-2">
              <Link
                to={`/portfolios/${p.id}`}
                className="text-blue-600 hover:underline"
              >
                {p.name}
                <span className="ml-2 text-xs text-gray-400">
                  {p.baseCurrency}
                </span>
              </Link>
              <button
                className="text-sm text-red-600 hover:underline"
                onClick={() => deletePortfolio(p.id)}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
