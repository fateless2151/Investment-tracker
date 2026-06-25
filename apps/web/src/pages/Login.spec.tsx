import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Login } from './Login';
import { api } from '../lib/api';
import { useAuthStore } from '../stores/authStore';

vi.mock('../lib/api', () => ({ api: { post: vi.fn() } }));

function renderLogin() {
  return render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>,
  );
}

describe('Login', () => {
  beforeEach(() => {
    vi.mocked(api.post).mockReset();
    useAuthStore.setState({ token: null, user: null });
  });

  it('renders the form fields and a link to register', () => {
    renderLogin();
    expect(screen.getByPlaceholderText('Email')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Password')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /create one/i })).toBeInTheDocument();
  });

  it('submits credentials and stores the token on success', async () => {
    vi.mocked(api.post).mockResolvedValue({
      accessToken: 'tok-123',
      user: { id: '1', email: 'a@b.com', name: null, createdAt: '' },
    });
    renderLogin();

    fireEvent.change(screen.getByPlaceholderText('Email'), {
      target: { value: 'a@b.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('Password'), {
      target: { value: 'password123' },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }));
    });

    expect(api.post).toHaveBeenCalledWith('/auth/login', {
      email: 'a@b.com',
      password: 'password123',
    });
    expect(useAuthStore.getState().token).toBe('tok-123');
  });
});
