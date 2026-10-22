import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthPanel } from './AuthPanel.js';

const authMocks = vi.hoisted(() => ({
  signUpEmail: vi.fn(),
  signInEmail: vi.fn()
}));

vi.mock('./auth-client.js', () => ({
  authClient: {
    signUp: { email: authMocks.signUpEmail },
    signIn: { email: authMocks.signInEmail }
  }
}));

describe('AuthPanel', () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.signUpEmail.mockResolvedValue({ data: {}, error: null });
    authMocks.signInEmail.mockResolvedValue({ data: {}, error: null });
  });

  it('submits the account name, email, and password during registration', async () => {
    const user = userEvent.setup();
    render(<AuthPanel />);
    await user.click(screen.getByRole('button', { name: 'Criar uma conta' }));
    await user.type(screen.getByLabelText('Nome'), 'Ari Lima');
    await user.type(screen.getByLabelText('Email'), 'ari@example.test');
    await user.type(screen.getByLabelText('Senha'), 'strong-password');
    await user.type(screen.getByLabelText('Confirmar senha'), 'strong-password');
    await user.click(screen.getByRole('button', { name: 'Criar conta' }));

    expect(authMocks.signUpEmail).toHaveBeenCalledWith({
      name: 'Ari Lima',
      email: 'ari@example.test',
      password: 'strong-password'
    });
  });

  it('submits email and password during login', async () => {
    const user = userEvent.setup();
    render(<AuthPanel />);
    await user.type(screen.getByLabelText('Email'), 'ari@example.test');
    await user.type(screen.getByLabelText('Senha'), 'strong-password');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(authMocks.signInEmail).toHaveBeenCalledWith({
      email: 'ari@example.test',
      password: 'strong-password'
    });
  });

  it('shows the same accessible fields after switching between modes', async () => {
    const user = userEvent.setup();
    render(<AuthPanel />);
    await user.click(screen.getByRole('button', { name: 'Criar uma conta' }));

    expect(screen.getByLabelText('Nome')).toBeTruthy();
    expect(screen.getByLabelText('Email')).toBeTruthy();
    expect(screen.getByLabelText('Senha')).toBeTruthy();
    expect(screen.getByLabelText('Confirmar senha')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Já tem uma conta? Entrar' }));
    expect(screen.queryByLabelText('Nome')).toBeNull();
    expect(screen.getByLabelText('Email')).toBeTruthy();
    expect(screen.getByLabelText('Senha')).toBeTruthy();
  });

  it('does not submit registration when password confirmation differs', async () => {
    const user = userEvent.setup();
    render(<AuthPanel />);
    await user.click(screen.getByRole('button', { name: 'Criar uma conta' }));
    await user.type(screen.getByLabelText('Nome'), 'Ari Lima');
    await user.type(screen.getByLabelText('Email'), 'ari@example.test');
    await user.type(screen.getByLabelText('Senha'), 'strong-password');
    await user.type(screen.getByLabelText('Confirmar senha'), 'different-password');
    await user.click(screen.getByRole('button', { name: 'Criar conta' }));

    expect(authMocks.signUpEmail).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toContain('As senhas não coincidem');
  });

  it('shows a generic auth error without exposing server details', async () => {
    authMocks.signInEmail.mockResolvedValue({
      data: null,
      error: { message: 'MongoServerError: private database detail' }
    });
    const user = userEvent.setup();
    render(<AuthPanel />);
    await user.type(screen.getByLabelText('Email'), 'ari@example.test');
    await user.type(screen.getByLabelText('Senha'), 'wrong-password');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    expect((await screen.findByRole('alert')).textContent).toContain('Não foi possível entrar');
    expect(screen.queryByText(/MongoServerError/)).toBeNull();
  });
});
