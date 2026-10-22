'use client';

import { FormEvent, useState } from 'react';
import { Code2, LockKeyhole, Sparkles } from 'lucide-react';

export function LoginForm() {
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'No se pudo iniciar sesión.');
      window.location.assign('/');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo iniciar sesión.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-screen">
      <section className="login-card">
        <div className="brand-mark"><LockKeyhole size={22} /></div>
        <p className="eyebrow">Tu espacio de trabajo</p>
        <h1>Pocket Manager</h1>
        <p className="muted">Ingresa tu PIN para continuar.</p>
        <form onSubmit={submit}>
          <label htmlFor="pin">PIN de acceso</label>
          <input
            id="pin"
            type="password"
            inputMode="numeric"
            autoComplete="current-password"
            required
            maxLength={128}
            value={pin}
            onChange={(event) => setPin(event.target.value)}
            className="pin-input"
          />
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="primary-button full-width" type="submit" disabled={busy}>
            {busy ? 'Verificando…' : 'Ingresar'}
          </button>
        </form>
        <div className="login-brands">
          <span className="login-brand-chip kt"><Code2 size={15} /> KTsoftware</span>
          <span className="login-brand-chip etiquetame"><Sparkles size={15} /> Etiquétame</span>
        </div>
        <p className="login-footer">Tus ideas, siempre listas para publicar.</p>
      </section>
    </main>
  );
}
