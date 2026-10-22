import { useState, type FormEvent } from 'react';
import { authClient } from './auth-client.js';

type AuthMode = 'sign-in' | 'sign-up';

export function AuthPanel() {
  const [mode, setMode] = useState<AuthMode>('sign-in');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isRegistration = mode === 'sign-up';

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError('');

    if (isRegistration && password !== passwordConfirmation) {
      setError('As senhas não coincidem.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = isRegistration
        ? await authClient.signUp.email({ name: name.trim(), email: email.trim().toLowerCase(), password })
        : await authClient.signIn.email({ email: email.trim().toLowerCase(), password });

      if (result.error) {
        setError(isRegistration
          ? 'Não foi possível criar a conta. Confira os dados e tente novamente.'
          : 'Não foi possível entrar. Confira seu email e sua senha.');
      }
    } catch {
      setError(isRegistration
        ? 'Não foi possível criar a conta. Confira os dados e tente novamente.'
        : 'Não foi possível entrar. Confira seu email e sua senha.');
    } finally {
      setIsSubmitting(false);
    }
  }

  function switchMode(nextMode: AuthMode): void {
    setMode(nextMode);
    setError('');
  }

  return (
    <main className="auth-page">
      <section aria-labelledby="auth-title" className="auth-panel">
        <p className="eyebrow">RIFTBOUND AI · ACESSO LOCAL</p>
        <h1 id="auth-title">{isRegistration ? 'Criar conta' : 'Entrar'}</h1>
        <p className="page-description">
          {isRegistration ? 'Crie uma conta para manter seus decks.' : 'Entre para acessar seus decks salvos.'}
        </p>

        <form className="auth-form" onSubmit={submit}>
          {isRegistration && (
            <div className="auth-field">
              <label htmlFor="auth-name">Nome</label>
              <input
                autoComplete="name"
                id="auth-name"
                onChange={(event) => setName(event.target.value)}
                required
                value={name}
              />
            </div>
          )}
          <div className="auth-field">
            <label htmlFor="auth-email">Email</label>
            <input
              autoComplete="email"
              id="auth-email"
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
          </div>
          <div className="auth-field">
            <label htmlFor="auth-password">Senha</label>
            <input
              autoComplete={isRegistration ? 'new-password' : 'current-password'}
              id="auth-password"
              minLength={8}
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </div>
          {isRegistration && (
            <div className="auth-field">
              <label htmlFor="auth-password-confirmation">Confirmar senha</label>
              <input
                autoComplete="new-password"
                id="auth-password-confirmation"
                minLength={8}
                onChange={(event) => setPasswordConfirmation(event.target.value)}
                required
                type="password"
                value={passwordConfirmation}
              />
            </div>
          )}

          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="button button-primary auth-submit" disabled={isSubmitting} type="submit">
            {isSubmitting ? 'Aguarde…' : isRegistration ? 'Criar conta' : 'Entrar'}
          </button>
        </form>

        <button
          className="text-button auth-mode-switch"
          onClick={() => switchMode(isRegistration ? 'sign-in' : 'sign-up')}
          type="button"
        >
          {isRegistration ? 'Já tem uma conta? Entrar' : 'Criar uma conta'}
        </button>
      </section>
    </main>
  );
}
