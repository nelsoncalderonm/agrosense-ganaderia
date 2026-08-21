'use client';

import { Finca, User, USERS, RoleKey } from '@/data/agrosense';

interface Props {
  open: boolean;
  finca: Finca;
  user: User;
  onClose: () => void;
  onNavigate: (tab: string) => void;
  onSetRole: (r: RoleKey) => void;
  variant?: 'sheet' | 'sidebar';
  activeTab?: string;
}

const MENU_ITEMS = [
  { key: 'inicio',    label: 'Inicio',          icon: 'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z' },
  { key: 'animales',  label: 'Animales',         icon: null, special: 'cow' },
  { key: 'rfid',      label: 'Lector RFID',      icon: 'M5 12.5a9 9 0 0114 0M8 15a5 5 0 018 0' },
  { key: 'agenda',    label: 'Calendario',       icon: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01' },
  { key: 'finanzas',  label: 'Finanzas',         icon: 'M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6' },
  { key: 'potreros',  label: 'Potreros',         icon: 'M3 7h18M3 12h18M3 17h18', locked: true },
  { key: 'reportes',  label: 'Reportes',         icon: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z' },
  { key: 'ajustes',   label: 'Ajustes',          icon: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z' },
];

export default function Drawer({ open, finca, user, onClose, onNavigate, onSetRole, variant = 'sheet', activeTab }: Props) {
  const isSidebar = variant === 'sidebar';
  if (!isSidebar && !open) return null;

  const handleNav = (key: string) => { onNavigate(key); if (!isSidebar) onClose(); };
  const handleSetRole = (r: RoleKey) => { onSetRole(r); if (!isSidebar) onClose(); };

  const body = (
    <>
      {/* Finca header */}
      <div style={{ padding: '20px 20px 14px', borderBottom: '1px solid #E1E8DD' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 8, background: '#DCFCE7', border: '1px solid #15A34A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 16, color: '#15A34A', flexShrink: 0 }}>{finca.ini}</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 16, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{finca.nombre}</div>
            <div style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 11, color: '#6E8A6E', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{finca.ubic} · {finca.animales} animales</div>
          </div>
        </div>
      </div>

      {/* Nav items */}
      <div style={{ padding: '8px 8px 0' }}>
        {MENU_ITEMS.map(item => {
          const active = isSidebar && activeTab === item.key;
          return (
            <button key={item.key} onClick={() => handleNav(item.key)} style={{
              display: 'flex', alignItems: 'center', gap: 12, width: '100%',
              padding: '12px 12px', borderRadius: 8,
              background: active ? '#F0FDF4' : 'none', border: 'none',
              cursor: 'pointer', textAlign: 'left', color: active ? '#15A34A' : '#1A2B1A',
            }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: '#fff', border: `1px solid ${active ? '#86EFAC' : '#E1E8DD'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {item.special === 'cow' ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? '#15A34A' : '#1A2B1A'} strokeWidth="1.8" strokeLinecap="round">
                    <ellipse cx="12" cy="14" rx="7" ry="5"/>
                    <path d="M8 9 Q7 6 5 5M16 9 Q17 6 19 5"/>
                    <circle cx="10" cy="16" r="1" fill={active ? '#15A34A' : '#1A2B1A'} stroke="none"/>
                    <circle cx="14" cy="16" r="1" fill={active ? '#15A34A' : '#1A2B1A'} stroke="none"/>
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? '#15A34A' : '#1A2B1A'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d={item.icon || ''}/>
                  </svg>
                )}
              </div>
              <span style={{ fontSize: 15, fontWeight: active ? 700 : 600 }}>{item.label}</span>
              {item.locked && (
                <span style={{ marginLeft: 'auto', background: '#F3F4F6', color: '#9DB39D', fontSize: 9.5, fontWeight: 700, borderRadius: 3, padding: '2px 6px' }}>PRO</span>
              )}
            </button>
          );
        })}
      </div>

      {/* User switcher */}
      <div style={{ margin: '12px 12px 0', background: '#fff', border: '1px solid #E1E8DD', borderRadius: 8, overflow: 'hidden' }}>
        <div style={{ padding: '10px 14px', borderBottom: '1px solid #E1E8DD' }}>
          <div style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 10, color: '#9DB39D', textTransform: 'uppercase', letterSpacing: '.5px' }}>Usuario activo</div>
        </div>
        {USERS.map(u => (
          <button key={u.roleKey} onClick={() => handleSetRole(u.roleKey)} style={{
            display: 'flex', alignItems: 'center', gap: 10, width: '100%',
            padding: '11px 14px', background: user.roleKey === u.roleKey ? '#F0FDF4' : 'transparent',
            border: 'none', borderTop: '1px solid #EDF1EA', cursor: 'pointer', textAlign: 'left',
          }}>
            <div style={{ width: 34, height: 34, borderRadius: '50%', background: user.roleKey === u.roleKey ? '#DCFCE7' : '#F3F4F6', border: user.roleKey === u.roleKey ? '1.5px solid #15A34A' : '1px solid #E1E8DD', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, color: user.roleKey === u.roleKey ? '#15A34A' : '#6E8A6E', flexShrink: 0 }}>{u.ini}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>{u.name}</div>
              <div style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 10.5, color: '#6E8A6E', marginTop: 1 }}>{u.role}</div>
            </div>
            {user.roleKey === u.roleKey && (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#15A34A" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
            )}
          </button>
        ))}
      </div>
    </>
  );

  if (isSidebar) {
    return (
      <div className="ag-sidebar" style={{
        display: 'none', flexDirection: 'column',
        position: 'fixed', top: 0, left: 0, bottom: 0, width: 240,
        background: '#fff', borderRight: '1px solid #E1E8DD',
        overflowY: 'auto', zIndex: 20,
      }}>
        {body}
      </div>
    );
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 40 }} />
      <div className="animate-slide-up ag-sheet-desktop" style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#EEF2EC', borderRadius: '16px 16px 0 0', zIndex: 50, maxHeight: '85%', overflowY: 'auto', paddingBottom: 24 }}>
        {body}
      </div>
    </>
  );
}
