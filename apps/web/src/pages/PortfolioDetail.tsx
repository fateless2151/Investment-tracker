import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { usePriceStore } from '../stores/priceStore';

export function PortfolioDetail() {
  const { id } = useParams<{ id: string }>();
  const { prices, subscribe, unsubscribe } = usePriceStore();

  // Demo: live-subscribe to a symbol over the /prices socket namespace.
  useEffect(() => {
    subscribe('AAPL');
    return () => unsubscribe('AAPL');
  }, [subscribe, unsubscribe]);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-medium">Portfolio {id}</h2>
      <div className="rounded-lg border bg-white p-4">
        <h3 className="mb-2 font-medium">Live Prices</h3>
        {Object.keys(prices).length === 0 ? (
          <p className="text-sm text-gray-500">
            Waiting for ticks… (requires the API + market-data feed running)
          </p>
        ) : (
          <ul className="text-sm">
            {Object.values(prices).map((p) => (
              <li key={p.symbol}>
                {p.symbol}: {p.price} {p.currency}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
