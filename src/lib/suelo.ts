// Interpretación sencilla de un análisis de suelo para pastos tropicales.
// Rangos de referencia generales (guías de interpretación usadas en Colombia
// para suelos ganaderos). Son una ayuda para leer el análisis, no una receta:
// la dosis de cal o fertilizante la define el agrónomo.

export type Nivel = 'bajo' | 'medio' | 'bien' | 'alto';

export type Parametro = {
  campo: 'ph' | 'materia_organica' | 'nitrogeno' | 'fosforo' | 'potasio' | 'calcio' | 'magnesio' | 'aluminio';
  nombre: string;
  unidad: string;
  ayuda: string;             // texto corto debajo del campo
  basico: boolean;           // se muestra siempre; los demás en "Más valores"
  evaluar: (v: number) => { nivel: Nivel; txt: string; consejo?: string };
};

export const PARAMETROS: Parametro[] = [
  {
    campo: 'ph', nombre: 'pH', unidad: '', basico: true, ayuda: 'Acidez del suelo (de 0 a 14)',
    evaluar: v => v < 5 ? { nivel: 'bajo', txt: 'Muy ácido', consejo: 'Suelo muy ácido: pregunta al agrónomo por encalado (cal agrícola o dolomita).' }
      : v < 5.5 ? { nivel: 'medio', txt: 'Ácido', consejo: 'Algo ácido: muchas gramíneas tropicales lo toleran, pero las leguminosas no.' }
      : v <= 7 ? { nivel: 'bien', txt: 'Adecuado' }
      : { nivel: 'alto', txt: 'Alcalino', consejo: 'Suelo alcalino: puede faltar fósforo y micronutrientes.' },
  },
  {
    campo: 'materia_organica', nombre: 'Materia orgánica', unidad: '%', basico: true, ayuda: 'MO, en porcentaje',
    evaluar: v => v < 2 ? { nivel: 'bajo', txt: 'Baja', consejo: 'Poca materia orgánica: ayuda dejar descansar el potrero y abonar con estiércol o compost.' }
      : v < 4 ? { nivel: 'medio', txt: 'Media' } : { nivel: 'bien', txt: 'Buena' },
  },
  {
    campo: 'nitrogeno', nombre: 'Nitrógeno total', unidad: '%', basico: true, ayuda: 'N total, en porcentaje',
    evaluar: v => v < 0.1 ? { nivel: 'bajo', txt: 'Bajo', consejo: 'Poco nitrógeno: el pasto crece lento. Leguminosas o abono nitrogenado ayudan.' }
      : v < 0.2 ? { nivel: 'medio', txt: 'Medio' } : { nivel: 'bien', txt: 'Bueno' },
  },
  {
    campo: 'fosforo', nombre: 'Fósforo', unidad: 'ppm', basico: true, ayuda: 'P disponible (Bray II), mg/kg o ppm',
    evaluar: v => v < 10 ? { nivel: 'bajo', txt: 'Bajo', consejo: 'Fósforo bajo: es de lo que más limita el pasto en suelos tropicales.' }
      : v < 20 ? { nivel: 'medio', txt: 'Medio' } : v <= 40 ? { nivel: 'bien', txt: 'Bueno' } : { nivel: 'alto', txt: 'Alto' },
  },
  {
    campo: 'potasio', nombre: 'Potasio', unidad: 'cmol/kg', basico: true, ayuda: 'K intercambiable, cmol(+)/kg o meq/100 g',
    evaluar: v => v < 0.2 ? { nivel: 'bajo', txt: 'Bajo', consejo: 'Potasio bajo: revisa con el agrónomo si conviene fertilizar.' }
      : v < 0.4 ? { nivel: 'medio', txt: 'Medio' } : { nivel: 'bien', txt: 'Bueno' },
  },
  {
    campo: 'calcio', nombre: 'Calcio', unidad: 'cmol/kg', basico: false, ayuda: 'Ca intercambiable',
    evaluar: v => v < 3 ? { nivel: 'bajo', txt: 'Bajo' } : v < 6 ? { nivel: 'medio', txt: 'Medio' } : { nivel: 'bien', txt: 'Bueno' },
  },
  {
    campo: 'magnesio', nombre: 'Magnesio', unidad: 'cmol/kg', basico: false, ayuda: 'Mg intercambiable',
    evaluar: v => v < 1 ? { nivel: 'bajo', txt: 'Bajo' } : v < 2.5 ? { nivel: 'medio', txt: 'Medio' } : { nivel: 'bien', txt: 'Bueno' },
  },
  {
    campo: 'aluminio', nombre: 'Aluminio', unidad: 'cmol/kg', basico: false, ayuda: 'Al intercambiable (mientras menos, mejor)',
    evaluar: v => v > 1.5 ? { nivel: 'bajo', txt: 'Alto, tóxico', consejo: 'Mucho aluminio: frena las raíces. Se corrige con encalado; pregunta al agrónomo.' }
      : v > 0.5 ? { nivel: 'medio', txt: 'Moderado' } : { nivel: 'bien', txt: 'Bajo, bien' },
  },
];

export const TEXTURAS = ['Arenoso', 'Franco arenoso', 'Franco', 'Franco limoso', 'Limoso', 'Franco arcilloso', 'Arcilloso'] as const;

/** Color por nivel: rojo = atender, ámbar = vigilar, verde = bien. */
export const COLOR_NIVEL: Record<Nivel, { color: string; fondo: string }> = {
  bajo:  { color: '#B91C1C', fondo: '#FEE2E2' },
  medio: { color: '#B45309', fondo: '#FEF3C7' },
  bien:  { color: '#15803D', fondo: '#DCFCE7' },
  alto:  { color: '#B45309', fondo: '#FEF3C7' },
};
