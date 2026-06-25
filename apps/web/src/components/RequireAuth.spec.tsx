import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { RequireAuth } from './RequireAuth';
import { useAuthStore } from '../stores/authStore';

function renderApp() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route
          path="/"
          element={
            <RequireAuth>
              <div>protected content</div>
            </RequireAuth>
          }
        />
        <Route path="/login" element={<div>login page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('RequireAuth', () => {
  afterEach(() => {
    useAuthStore.setState({ token: null, user: null });
  });

  it('redirects to /login when there is no token', () => {
    useAuthStore.setState({ token: null });
    renderApp();
    expect(screen.getByText('login page')).toBeInTheDocument();
    expect(screen.queryByText('protected content')).not.toBeInTheDocument();
  });

  it('renders the protected content when authenticated', () => {
    useAuthStore.setState({ token: 'a-token' });
    renderApp();
    expect(screen.getByText('protected content')).toBeInTheDocument();
  });
});
