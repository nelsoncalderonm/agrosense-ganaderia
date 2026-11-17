'use client';

import dynamic from 'next/dynamic';

// El tablero lee el token del televisor (localStorage) desde el primer render: solo corre en el navegador.
const TableroTV = dynamic(() => import('./TableroTV'), {
  ssr: false,
  loading: () => <div style={{ position: 'fixed', inset: 0, background: '#0B140B' }} />,
});

export default function TableroTVCliente() {
  return <TableroTV />;
}
