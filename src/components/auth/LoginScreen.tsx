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
    width: '100%', height: 48, border: '1.5px solid #C5D2C0', borderRadius: 4,
    padding: '0 14px', fontSize: 15, background: '#fff', outline: 'none',
    fontFamily: 'inherit', color: '#1A2B1A', boxSizing: 'border-box',
  };
  const lbl: React.CSSProperties = {
    fontSize: 11, color: '#6E8A6E', fontWeight: 700, letterSpacing: '.4px',
    marginBottom: 6, display: 'block',
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#EEF2EC', padding: 20 }}>
      <form onSubmit={submit} style={{ width: '100%', maxWidth: 360, background: '#fff', border: '1px solid #E1E8DD', borderRadius: 8, padding: '32px 28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22 }}>
          <div style={{ width: 40, height: 40, borderRadius: 8, background: '#DCFCE7', border: '1px solid #15A34A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#15A34A" strokeWidth="1.8" strokeLinecap="round"><ellipse cx="12" cy="14" rx="7" ry="5"/><path d="M8 9 Q7 6 5 5M16 9 Q17 6 19 5"/></svg>
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 18, lineHeight: 1 }}>AgroSense</div>
            <div style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 10.5, color: '#6E8A6E', marginTop: 3 }}>Inicia sesión para continuar</div>
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
          <div style={{ fontSize: 12.5, color: '#DC2626', background: '#FEE2E2', border: '1px solid #FCA5A5', padding: '8px 12px', borderRadius: 4, marginBottom: 14 }}>{err}</div>
        )}

        <button type="submit" disabled={loading} style={{
          width: '100%', height: 48, border: 'none', borderRadius: 4,
          background: loading ? '#6E8A6E' : '#15A34A', color: '#fff', fontWeight: 800, fontSize: 14,
          cursor: loading ? 'default' : 'pointer', boxShadow: '0 4px 14px rgba(21,163,74,.25)',
        }}>
          {loading ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}
