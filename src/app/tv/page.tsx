import type { Metadata } from 'next';
import TableroTVCliente from '@/components/tv/TableroTVCliente';

export const metadata: Metadata = {
  title: 'Ganado al Día · Tablero',
  robots: { index: false, follow: false },
};

export default function PaginaTV() {
  return <TableroTVCliente />;
}
