/**
 * Utility for verifying Live Support Chat operating hours.
 * Official schedule: Monday to Friday from 9:00 AM to 5:00 PM Central Mexico Time (CDMX / Guadalajara).
 * Timezone: 'America/Mexico_City'
 */

export interface SupportScheduleStatus {
  isOpen: boolean;
  currentTimeStr: string;
  nextOpenStr: string;
  dayName: string;
  hour: number;
  minute: number;
}

export function getSupportScheduleStatus(date = new Date()): SupportScheduleStatus {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Mexico_City',
    weekday: 'short',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false
  });

  const parts = formatter.formatToParts(date);
  const map: Record<string, string> = {};
  for (const part of parts) {
    map[part.type] = part.value;
  }

  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6
  };
  const dayOfWeek = weekdayMap[map.weekday] ?? 0;

  let hour = parseInt(map.hour || '0', 10);
  if (hour === 24) hour = 0;
  const minute = parseInt(map.minute || '0', 10);

  const totalMinutes = hour * 60 + minute;
  const START_MINUTES = 9 * 60; // 09:00 AM -> 540
  const END_MINUTES = 17 * 60;  // 05:00 PM -> 1020

  const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
  const isOpen = isWeekday && totalMinutes >= START_MINUTES && totalMinutes < END_MINUTES;

  // Format 12-hour clock representation in Mexico City (e.g., "11:20 a. m.")
  const timeFormatter12 = new Intl.DateTimeFormat('es-MX', {
    timeZone: 'America/Mexico_City',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
  const currentTimeStr = timeFormatter12.format(date);

  // Compute next opening time
  let nextOpenStr = '';
  if (isWeekday && totalMinutes < START_MINUTES) {
    nextOpenStr = 'hoy a las 9:00 AM (hora CDMX / GDL)';
  } else if (dayOfWeek >= 1 && dayOfWeek <= 4 && totalMinutes >= END_MINUTES) {
    const dayNames = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    const nextDay = dayNames[dayOfWeek + 1];
    nextOpenStr = `mañana ${nextDay} a las 9:00 AM (hora CDMX / GDL)`;
  } else {
    // Friday after 5:00 PM, Saturday, or Sunday
    nextOpenStr = 'el próximo lunes a las 9:00 AM (hora CDMX / GDL)';
  }

  const dayNamesEs = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

  return {
    isOpen,
    currentTimeStr,
    nextOpenStr,
    dayName: dayNamesEs[dayOfWeek] || 'Desconocido',
    hour,
    minute
  };
}
