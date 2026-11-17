import type { Metadata } from 'next';
import SoporteChat from '@/components/soporte/SoporteChat';

export const metadata: Metadata = {
  title: 'Ayuda · Ganado al Día',
  description: 'Resuelva sus dudas sobre Ganado al Día con nuestro asistente, o hable con un asesor.',
};

// Página pública de ayuda. Sirve como enlace directo (bio de WhatsApp, Instagram)
// y como contenido del widget que se incrusta en la landing (?origen=landing).
export default async function SoportePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { origen } = await searchParams;
  return (
    <main style={{ minHeight: '100dvh', background: '#EEF2EC' }}>
      <SoporteChat origen={origen === 'landing' ? 'landing' : 'web'} embebido />
    </main>
  );
}
