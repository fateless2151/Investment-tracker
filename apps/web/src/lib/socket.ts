import { io, Socket } from 'socket.io-client';
import {
  PRICE_NAMESPACE,
  PriceEvents,
  type PriceUpdate,
} from '@investment-tracker/shared-types';

const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ?? 'http://localhost:3000';

let socket: Socket | null = null;

/** Connect (once) to the `/prices` namespace. */
export function getPriceSocket(): Socket {
  if (!socket) {
    socket = io(`${SOCKET_URL}${PRICE_NAMESPACE}`, {
      transports: ['websocket'],
      autoConnect: true,
    });
  }
  return socket;
}

export function subscribeToSymbol(
  symbol: string,
  onUpdate: (update: PriceUpdate) => void,
): () => void {
  const s = getPriceSocket();
  s.emit(PriceEvents.Subscribe, symbol);
  s.on(PriceEvents.Update, onUpdate);

  return () => {
    s.emit(PriceEvents.Unsubscribe, symbol);
    s.off(PriceEvents.Update, onUpdate);
  };
}
