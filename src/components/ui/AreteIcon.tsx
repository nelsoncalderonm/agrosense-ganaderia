// Ícono de chapeta (arete) para identificar al animal. El ganado no lleva
// nombre: se identifica solo por el número de arete.
export default function AreteIcon({ color, size = 24 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2.5l6.5 5.2v11.3a2.5 2.5 0 01-2.5 2.5H8a2.5 2.5 0 01-2.5-2.5V7.7z" />
      <circle cx="12" cy="7.5" r="1.6" />
      <path d="M9 13h6M9 16.5h6" />
    </svg>
  );
}
