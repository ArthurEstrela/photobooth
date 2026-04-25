import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AdminLoginPage } from './AdminLoginPage';

const mockAdminLogin = vi.fn();
const mockNavigate = vi.fn();

vi.mock('../context/AdminAuthContext', () => ({
  useAdminAuth: () => ({ adminLogin: mockAdminLogin }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

describe('AdminLoginPage', () => {
  beforeEach(() => {
    mockAdminLogin.mockReset();
    mockNavigate.mockReset();
  });

  it('renders email and password fields', () => {
    render(<AdminLoginPage />);
    expect(screen.getByPlaceholderText('Email')).toBeTruthy();
    expect(screen.getByPlaceholderText('Senha')).toBeTruthy();
  });

  it('calls adminLogin with form values on submit', async () => {
    mockAdminLogin.mockResolvedValue(undefined);
    render(<AdminLoginPage />);
    fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'a@a.com' } });
    fireEvent.change(screen.getByPlaceholderText('Senha'), { target: { value: 'pass123' } });
    fireEvent.click(screen.getByRole('button', { name: /entrar/i }));
    await waitFor(() => expect(mockAdminLogin).toHaveBeenCalledWith('a@a.com', 'pass123'));
  });

  it('navigates to /admin on successful login', async () => {
    mockAdminLogin.mockResolvedValue(undefined);
    render(<AdminLoginPage />);
    fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'a@a.com' } });
    fireEvent.change(screen.getByPlaceholderText('Senha'), { target: { value: 'pass' } });
    fireEvent.click(screen.getByRole('button', { name: /entrar/i }));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/admin'));
  });

  it('shows error message on failed login', async () => {
    mockAdminLogin.mockRejectedValue(new Error('Credenciais inválidas'));
    render(<AdminLoginPage />);
    fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'a@a.com' } });
    fireEvent.change(screen.getByPlaceholderText('Senha'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: /entrar/i }));
    await waitFor(() => expect(screen.getByText('Credenciais inválidas')).toBeTruthy());
  });
});
