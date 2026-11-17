'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setLoading(true);
    setErr(null);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) setErr(error.message === 'Invalid login credentials' ? 'Correo o contraseña incorrectos' : error.message);
  };

  const inp: React.CSSProperties = {
    width: '100%', height: 48, border: '1.5px solid #8FA38A', borderRadius: 4,
    padding: '0 14px', fontSize: 19, background: '#fff', outline: 'none',
    fontFamily: 'inherit', color: '#0F1A0F', boxSizing: 'border-box',
  };
  const lbl: React.CSSProperties = {
    fontSize: 15, color: '#3A4D3A', fontWeight: 700, letterSpacing: '.4px',
    marginBottom: 6, display: 'block',
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#EEF2EC', padding: 20 }}>
      <form onSubmit={submit} style={{ width: '100%', maxWidth: 360, background: '#fff', border: '1px solid #B9C6B4', borderRadius: 8, padding: '32px 28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22 }}>
          <div style={{ width: 40, height: 40, borderRadius: 8, background: '#DCFCE7', border: '1px solid #15803D', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#15803D" strokeWidth="1.8" strokeLinecap="round"><ellipse cx="12" cy="14" rx="7" ry="5"/><path d="M8 9 Q7 6 5 5M16 9 Q17 6 19 5"/></svg>
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 21, lineHeight: 1 }}>Ganado al Día</div>
            <div style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 14, color: '#3A4D3A', marginTop: 3 }}>Inicia sesión para continuar</div>
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={lbl}>CORREO</label>
          <input style={inp} type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="tu@correo.com" autoFocus />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={lbl}>CONTRASEÑA</label>
          <input style={inp} type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
        </div>

        {err && (
          <div style={{ fontSize: 16, color: '#B91C1C', background: '#FEE2E2', border: '1px solid #FCA5A5', padding: '8px 12px', borderRadius: 4, marginBottom: 14 }}>{err}</div>
        )}

        <button type="submit" disabled={loading} style={{
          width: '100%', height: 48, border: 'none', borderRadius: 4,
          background: loading ? '#3A4D3A' : '#15803D', color: '#fff', fontWeight: 800, fontSize: 18,
          cursor: loading ? 'default' : 'pointer', boxShadow: '0 4px 14px rgba(21,163,74,.25)',
        }}>
          {loading ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}
