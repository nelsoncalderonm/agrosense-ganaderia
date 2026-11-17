// Errores del servidor en palabras que entienda un vaquero o un administrador.
export function mensajeAmigable(error: string | null | undefined): string {
  if (!error) return 'Error desconocido';
  if (/no encontrado o inactivo/i.test(error)) return 'El animal ya no está activo (vendido, muerto o trasladado).';
  if (/row-level security|Sin acceso/i.test(error)) return 'Tu usuario no tiene permiso para este registro en esta finca.';
  if (/fecha del celular/i.test(error)) return error;
  if (/Peso inválido/i.test(error)) return 'El peso no es válido.';
  if (/finca destino es la misma/i.test(error)) return 'La finca destino es la misma finca.';
  return error;
}
