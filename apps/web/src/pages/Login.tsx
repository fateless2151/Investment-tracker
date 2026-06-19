import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AuthResponse } from '@investment-tracker/shared-types';
import { api } from '../lib/api';
import { useAuthStore } from '../stores/authStore';

export function Login() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const res = await api.post<AuthResponse>('/auth/login', {
        email,
        password,
      });
      setAuth(res.accessToken, res.user);
      navigate('/');
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-sm space-y-4">
      <h2 className="text-lg font-medium">Sign in</h2>
      <input
        className="w-full rounded border px-3 py-2"
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        className="w-full rounded border px-3 py-2"
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        className="w-full rounded bg-blue-600 py-2 text-white hover:bg-blue-700"
      >
        Sign in
      </button>
    </form>
  );
}
