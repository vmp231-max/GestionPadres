// Módulo utilitario para el cálculo y gestión de la periodicidad / pautas de medicamentos

export type ScheduleType = 
  | 'diario' 
  | 'dias_semana' 
  | 'dias_alternos' 
  | 'semanal' 
  | 'mensual' 
  | 'segun_necesidad';

export interface DayOption {
  key: string;      // 'L', 'M', 'X', 'J', 'V', 'S', 'D'
  label: string;    // 'Lunes', 'Martes', etc.
  short: string;    // 'Lun', 'Mar', etc.
  jsDay: number;    // 0 = Domingo, 1 = Lunes, ..., 6 = Sábado
}

export const DAYS_OF_WEEK: DayOption[] = [
  { key: 'L', label: 'Lunes', short: 'Lun', jsDay: 1 },
  { key: 'M', label: 'Martes', short: 'Mar', jsDay: 2 },
  { key: 'X', label: 'Miércoles', short: 'Mié', jsDay: 3 },
  { key: 'J', label: 'Jueves', short: 'Jue', jsDay: 4 },
  { key: 'V', label: 'Viernes', short: 'Vie', jsDay: 5 },
  { key: 'S', label: 'Sábado', short: 'Sáb', jsDay: 6 },
  { key: 'D', label: 'Domingo', short: 'Dom', jsDay: 0 },
];

/**
 * Normaliza un texto eliminando acentos y pasando a minúsculas
 */
function normalizeText(text?: string): string {
  if (!text) return '';
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Infiere automáticamente el tipo de pauta y días a partir del texto de frecuencia/comentarios
 */
export function inferScheduleFromText(frequency?: string, comments?: string): { schedule_type: ScheduleType; schedule_days: string } {
  const combined = normalizeText(frequency) + ' ' + normalizeText(comments);

  if (combined.includes('si precisa') || combined.includes('segun necesidad') || combined.includes('sos') || combined.includes('en caso de') || combined.includes('si hay dolor') || combined.includes('a demanda')) {
    return { schedule_type: 'segun_necesidad', schedule_days: '' };
  }

  if (combined.includes('dias alternos') || combined.includes('cada 2 dias') || combined.includes('cada 48h') || combined.includes('cada 48 horas') || combined.includes('un dia si')) {
    return { schedule_type: 'dias_alternos', schedule_days: '' };
  }

  if (combined.includes('lunes y jueves') || combined.includes('lunes, jueves') || combined.includes('l y j')) {
    return { schedule_type: 'dias_semana', schedule_days: 'L,J' };
  }

  if (combined.includes('lunes, miercoles y viernes') || combined.includes('l, m, v') || combined.includes('l-m-v') || combined.includes('lunes, miercoles, viernes')) {
    return { schedule_type: 'dias_semana', schedule_days: 'L,X,V' };
  }

  if (combined.includes('martes y jueves') || combined.includes('m y j')) {
    return { schedule_type: 'dias_semana', schedule_days: 'M,J' };
  }

  if (combined.includes('fin de semana') || combined.includes('sabados y domingos') || combined.includes('sabado y domingo')) {
    return { schedule_type: 'dias_semana', schedule_days: 'S,D' };
  }

  if (combined.includes('semanal') || combined.includes('1 vez a la semana') || combined.includes('una vez por semana') || combined.includes('cada semana')) {
    if (combined.includes('lunes')) return { schedule_type: 'semanal', schedule_days: 'L' };
    if (combined.includes('martes')) return { schedule_type: 'semanal', schedule_days: 'M' };
    if (combined.includes('miercoles')) return { schedule_type: 'semanal', schedule_days: 'X' };
    if (combined.includes('jueves')) return { schedule_type: 'semanal', schedule_days: 'J' };
    if (combined.includes('viernes')) return { schedule_type: 'semanal', schedule_days: 'V' };
    if (combined.includes('sabado')) return { schedule_type: 'semanal', schedule_days: 'S' };
    if (combined.includes('domingo')) return { schedule_type: 'semanal', schedule_days: 'D' };
    return { schedule_type: 'semanal', schedule_days: 'L' };
  }

  if (combined.includes('mensual') || combined.includes('1 vez al mes') || combined.includes('cada mes') || combined.includes('una vez al mes')) {
    const matchDay = combined.match(/dia\s+(\d{1,2})/);
    const day = matchDay ? matchDay[1] : '1';
    return { schedule_type: 'mensual', schedule_days: day };
  }

  return { schedule_type: 'diario', schedule_days: '' };
}

/**
 * Comprueba si un medicamento está programado para tomarse en la fecha indicada (por defecto hoy)
 */
export function isScheduledForToday(med: {
  schedule_type?: string;
  schedule_days?: string;
  frequency?: string;
  comments?: string;
  created_at?: string;
}, date: Date = new Date()): boolean {
  let scheduleType = med.schedule_type as ScheduleType | undefined;
  let scheduleDays = med.schedule_days || '';

  // Si no está explícito en la base de datos, inferir por el texto
  if (!scheduleType || scheduleType === ('diario' as any)) {
    const inferred = inferScheduleFromText(med.frequency, med.comments);
    if (!scheduleType) {
      scheduleType = inferred.schedule_type;
      scheduleDays = inferred.schedule_days;
    }
  }

  // 1. Diario: todos los días
  if (scheduleType === 'diario') {
    return true;
  }

  // 2. Según necesidad / SOS: no forma parte de la rutina obligatoria del día
  if (scheduleType === 'segun_necesidad') {
    return false;
  }

  // 3. Días específicos de la semana
  if (scheduleType === 'dias_semana') {
    if (!scheduleDays) return true;
    const jsDay = date.getDay(); // 0 = Domingo, 1 = Lunes, etc.
    const selectedKeys = scheduleDays.split(',').map(s => s.trim().toUpperCase());
    
    const todayOption = DAYS_OF_WEEK.find(d => d.jsDay === jsDay);
    if (todayOption && selectedKeys.includes(todayOption.key)) {
      return true;
    }
    // También soportar nombres completos en minúsculas
    const normDays = normalizeText(scheduleDays);
    const todayName = todayOption ? normalizeText(todayOption.label) : '';
    return normDays.includes(todayName);
  }

  // 4. Días alternos (Cada 2 días)
  if (scheduleType === 'dias_alternos') {
    // Calculamos según el día del año para que sea determinista
    const start = new Date(date.getFullYear(), 0, 0);
    const diff = date.getTime() - start.getTime();
    const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
    return dayOfYear % 2 === 0;
  }

  // 5. Semanal (1 día a la semana)
  if (scheduleType === 'semanal') {
    const jsDay = date.getDay();
    const todayOption = DAYS_OF_WEEK.find(d => d.jsDay === jsDay);
    const key = (scheduleDays || 'L').trim().toUpperCase();
    return todayOption ? todayOption.key === key || normalizeText(todayOption.label) === normalizeText(scheduleDays) : false;
  }

  // 6. Mensual (1 día concreto del mes)
  if (scheduleType === 'mensual') {
    const targetDay = parseInt(scheduleDays || '1', 10);
    return date.getDate() === targetDay;
  }

  return true;
}

/**
 * Comprueba si un medicamento es de tipo 'segun_necesidad' (SOS / Si precisa)
 */
export function isPrnMedication(med: {
  schedule_type?: string;
  frequency?: string;
  comments?: string;
}): boolean {
  if (med.schedule_type === 'segun_necesidad') return true;
  const inferred = inferScheduleFromText(med.frequency, med.comments);
  return inferred.schedule_type === 'segun_necesidad';
}

/**
 * Devuelve un texto descriptivo y amigable de la periodicidad para mostrar en badges o tarjetas
 */
export function getScheduleDescription(med: {
  schedule_type?: string;
  schedule_days?: string;
  frequency?: string;
  comments?: string;
}): string {
  let scheduleType = med.schedule_type as ScheduleType | undefined;
  let scheduleDays = med.schedule_days || '';

  if (!scheduleType) {
    const inferred = inferScheduleFromText(med.frequency, med.comments);
    scheduleType = inferred.schedule_type;
    scheduleDays = inferred.schedule_days;
  }

  switch (scheduleType) {
    case 'dias_semana': {
      if (!scheduleDays) return 'Días específicos';
      const keys = scheduleDays.split(',').map(k => k.trim().toUpperCase());
      const names = keys.map(k => {
        const d = DAYS_OF_WEEK.find(item => item.key === k);
        return d ? d.short : k;
      });
      return `Días: ${names.join(', ')}`;
    }
    case 'dias_alternos':
      return 'Días alternos (Cada 2 días)';
    case 'semanal': {
      const key = (scheduleDays || 'L').trim().toUpperCase();
      const d = DAYS_OF_WEEK.find(item => item.key === key);
      return `Semanal (Cada ${d ? d.label : scheduleDays})`;
    }
    case 'mensual':
      return `Mensual (Día ${scheduleDays || 1} de cada mes)`;
    case 'segun_necesidad':
      return 'Si precisa (SOS / Según necesidad)';
    case 'diario':
    default:
      return 'Todos los días (Diario)';
  }
}
