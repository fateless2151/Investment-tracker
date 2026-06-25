import {
  FormEvent,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Link, useParams } from 'react-router-dom';
import type {
  AssetType,
  Portfolio,
  PortfolioHistory,
  PortfolioValuation,
  Position,
  Transaction,
  TransactionType,
} from '@investment-tracker/shared-types';
import { api } from '../lib/api';
import { formatMoney, formatNumber, formatPct, toNumber } from '../lib/format';
import { usePriceStore } from '../stores/priceStore';
import { AllocationChart } from '../components/charts/AllocationChart';
import { PnLChart } from '../components/charts/PnLChart';

const ASSET_TYPES: AssetType[] = ['STOCK', 'CRYPTO', 'ETF', 'CASH'];
const TRANSACTION_TYPES: TransactionType[] = [
  'BUY',
  'SELL',
  'DIVIDEND',
  'DEPOSIT',
  'WITHDRAWAL',
];

export function PortfolioDetail() {
  const { id } = useParams<{ id: string }>();
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [valuation, setValuation] = useState<PortfolioValuation | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [history, setHistory] = useState<PortfolioHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { prices, subscribe, unsubscribe } = usePriceStore();

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [p, v, txns, hist] = await Promise.all([
        api.get<Portfolio>(`/portfolios/${id}`),
        api
          .get<PortfolioValuation>(`/portfolios/${id}/valuation`)
          .catch(() => null),
        api.get<Transaction[]>(`/transactions/portfolio/${id}`),
        api.get<PortfolioHistory>(`/portfolios/${id}/history`).catch(() => null),
      ]);
      setPortfolio(p);
      setValuation(v);
      setTransactions(txns);
      setHistory(hist);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // Live-subscribe to the symbols held in this portfolio.
  const symbols = useMemo(
    () => (portfolio?.positions ?? []).map((pos) => pos.symbol),
    [portfolio],
  );
  useEffect(() => {
    symbols.forEach(subscribe);
    return () => symbols.forEach(unsubscribe);
  }, [symbols, subscribe, unsubscribe]);

  const currency = portfolio?.baseCurrency ?? 'USD';
  const positions = portfolio?.positions ?? [];

  const allocation = useMemo(
    () =>
      positions
        .map((pos) => ({
          name: pos.symbol,
          value: toNumber(pos.quantity) * toNumber(pos.avgCostBasis),
        }))
        .filter((slice) => slice.value > 0),
    [positions],
  );

  async function deletePosition(positionId: string) {
    await api.delete(`/portfolios/${id}/positions/${positionId}`);
    await load();
  }

  if (loading) return <p className="text-sm text-gray-500">Loading…</p>;
  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!portfolio) return <p className="text-sm text-gray-500">Not found.</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">{portfolio.name}</h2>
        <Link to="/" className="text-sm text-blue-600 hover:underline">
          ← All portfolios
        </Link>
      </div>

      <ValuationSummary valuation={valuation} currency={currency} />

      <section className="rounded-lg border bg-white p-4">
        <h3 className="mb-2 font-medium">Cost basis over time</h3>
        {history && history.points.length > 0 ? (
          <PnLChart
            data={history.points.map((pt) => ({
              date: pt.date,
              value: toNumber(pt.costBasis),
            }))}
          />
        ) : (
          <p className="text-sm text-gray-500">
            No transaction history yet — record a trade to build the series.
          </p>
        )}
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <div className="rounded-lg border bg-white p-4">
          <h3 className="mb-2 font-medium">Allocation (by cost basis)</h3>
          {allocation.length > 0 ? (
            <AllocationChart data={allocation} />
          ) : (
            <p className="text-sm text-gray-500">No positions yet.</p>
          )}
        </div>
        <AddPositionForm
          portfolioId={portfolio.id}
          defaultCurrency={currency}
          onAdded={load}
        />
      </section>

      <section className="rounded-lg border bg-white p-4">
        <h3 className="mb-3 font-medium">Positions</h3>
        {positions.length === 0 ? (
          <p className="text-sm text-gray-500">No positions yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-gray-500">
              <tr>
                <th className="py-1">Symbol</th>
                <th>Type</th>
                <th className="text-right">Qty</th>
                <th className="text-right">Avg cost</th>
                <th className="text-right">Live price</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {positions.map((pos) => (
                <PositionRow
                  key={pos.id}
                  position={pos}
                  livePrice={prices[pos.symbol]?.price}
                  currency={currency}
                  onDelete={() => deletePosition(pos.id)}
                />
              ))}
            </tbody>
          </table>
        )}
      </section>

      <AddTransactionForm
        portfolioId={portfolio.id}
        defaultCurrency={currency}
        onAdded={load}
      />

      <TransactionsTable transactions={transactions} currency={currency} />
    </div>
  );
}

function ValuationSummary({
  valuation,
  currency,
}: {
  valuation: PortfolioValuation | null;
  currency: string;
}) {
  if (!valuation) {
    return (
      <p className="text-sm text-gray-500">Valuation unavailable.</p>
    );
  }
  const gain = toNumber(valuation.unrealizedPnl) >= 0;
  return (
    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card label="Total value">
        {formatMoney(valuation.totalValue, currency)}
      </Card>
      <Card label="Market value">
        {formatMoney(valuation.marketValue, currency)}
      </Card>
      <Card label="Cash">{formatMoney(valuation.cash, currency)}</Card>
      <Card label="Unrealized P&L">
        <span className={gain ? 'text-green-600' : 'text-red-600'}>
          {formatMoney(valuation.unrealizedPnl, currency)} (
          {formatPct(valuation.unrealizedPnlPct)})
        </span>
      </Card>
    </section>
  );
}

function Card({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="text-xs uppercase tracking-wide text-gray-500">
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold">{children}</div>
    </div>
  );
}

function PositionRow({
  position,
  livePrice,
  currency,
  onDelete,
}: {
  position: Position;
  livePrice?: number;
  currency: string;
  onDelete: () => void;
}) {
  return (
    <tr className="border-t">
      <td className="py-2 font-medium">{position.symbol}</td>
      <td className="text-gray-500">{position.assetType}</td>
      <td className="text-right">{formatNumber(position.quantity)}</td>
      <td className="text-right">
        {formatMoney(position.avgCostBasis, position.currency)}
      </td>
      <td className="text-right">
        {livePrice != null ? (
          formatMoney(livePrice, currency)
        ) : (
          <span className="text-gray-400">—</span>
        )}
      </td>
      <td className="text-right">
        <button
          className="text-xs text-red-600 hover:underline"
          onClick={onDelete}
        >
          Remove
        </button>
      </td>
    </tr>
  );
}

function AddPositionForm({
  portfolioId,
  defaultCurrency,
  onAdded,
}: {
  portfolioId: string;
  defaultCurrency: string;
  onAdded: () => Promise<void> | void;
}) {
  const [symbol, setSymbol] = useState('');
  const [assetType, setAssetType] = useState<AssetType>('STOCK');
  const [quantity, setQuantity] = useState('');
  const [avgCostBasis, setAvgCostBasis] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.post(`/portfolios/${portfolioId}/positions`, {
        symbol: symbol.trim().toUpperCase(),
        assetType,
        quantity: Number(quantity),
        avgCostBasis: Number(avgCostBasis),
        currency: defaultCurrency,
      });
      setSymbol('');
      setQuantity('');
      setAvgCostBasis('');
      await onAdded();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-lg border bg-white p-4">
      <h3 className="mb-3 font-medium">Add position</h3>
      <form onSubmit={onSubmit} className="space-y-3 text-sm">
        <div className="grid grid-cols-2 gap-3">
          <input
            className="rounded border px-3 py-2"
            placeholder="Symbol"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            required
          />
          <select
            className="rounded border px-3 py-2"
            value={assetType}
            onChange={(e) => setAssetType(e.target.value as AssetType)}
          >
            {ASSET_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <input
            className="rounded border px-3 py-2"
            type="number"
            step="any"
            placeholder="Quantity"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            required
          />
          <input
            className="rounded border px-3 py-2"
            type="number"
            step="any"
            placeholder="Avg cost"
            value={avgCostBasis}
            onChange={(e) => setAvgCostBasis(e.target.value)}
            required
          />
        </div>
        {error && <p className="text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {submitting ? 'Adding…' : 'Add position'}
        </button>
      </form>
    </div>
  );
}

function AddTransactionForm({
  portfolioId,
  defaultCurrency,
  onAdded,
}: {
  portfolioId: string;
  defaultCurrency: string;
  onAdded: () => Promise<void> | void;
}) {
  const [type, setType] = useState<TransactionType>('BUY');
  const [symbol, setSymbol] = useState('');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [fees, setFees] = useState('');
  const [executedAt, setExecutedAt] = useState(
    new Date().toISOString().slice(0, 16),
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.post('/transactions', {
        portfolioId,
        type,
        symbol: symbol.trim().toUpperCase(),
        quantity: Number(quantity),
        price: Number(price),
        fees: fees ? Number(fees) : 0,
        currency: defaultCurrency,
        executedAt: new Date(executedAt).toISOString(),
      });
      setSymbol('');
      setQuantity('');
      setPrice('');
      setFees('');
      await onAdded();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="rounded-lg border bg-white p-4">
      <h3 className="mb-3 font-medium">Record transaction</h3>
      <form
        onSubmit={onSubmit}
        className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3"
      >
        <select
          className="rounded border px-3 py-2"
          value={type}
          onChange={(e) => setType(e.target.value as TransactionType)}
        >
          {TRANSACTION_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <input
          className="rounded border px-3 py-2"
          placeholder="Symbol"
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          required
        />
        <input
          className="rounded border px-3 py-2"
          type="number"
          step="any"
          placeholder="Quantity"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          required
        />
        <input
          className="rounded border px-3 py-2"
          type="number"
          step="any"
          placeholder="Price"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          required
        />
        <input
          className="rounded border px-3 py-2"
          type="number"
          step="any"
          placeholder="Fees"
          value={fees}
          onChange={(e) => setFees(e.target.value)}
        />
        <input
          className="rounded border px-3 py-2"
          type="datetime-local"
          value={executedAt}
          onChange={(e) => setExecutedAt(e.target.value)}
          required
        />
        {error && <p className="col-span-full text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="col-span-full rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50 sm:col-span-1"
        >
          {submitting ? 'Saving…' : 'Record'}
        </button>
      </form>
    </section>
  );
}

function TransactionsTable({
  transactions,
  currency,
}: {
  transactions: Transaction[];
  currency: string;
}) {
  return (
    <section className="rounded-lg border bg-white p-4">
      <h3 className="mb-3 font-medium">Transactions</h3>
      {transactions.length === 0 ? (
        <p className="text-sm text-gray-500">No transactions yet.</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-left text-gray-500">
            <tr>
              <th className="py-1">Date</th>
              <th>Type</th>
              <th>Symbol</th>
              <th className="text-right">Qty</th>
              <th className="text-right">Price</th>
              <th className="text-right">Realized P&L</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((t) => (
              <tr key={t.id} className="border-t">
                <td className="py-2">
                  {new Date(t.executedAt).toLocaleDateString()}
                </td>
                <td>{t.type}</td>
                <td>{t.symbol}</td>
                <td className="text-right">{formatNumber(t.quantity)}</td>
                <td className="text-right">
                  {formatMoney(t.price, t.currency || currency)}
                </td>
                <td className="text-right">
                  {t.realizedPnl == null ? (
                    <span className="text-gray-400">—</span>
                  ) : (
                    <span
                      className={
                        toNumber(t.realizedPnl) >= 0
                          ? 'text-green-600'
                          : 'text-red-600'
                      }
                    >
                      {formatMoney(t.realizedPnl, t.currency || currency)}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
