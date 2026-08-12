/**
 * All passenger and driver-facing strings in one dictionary (CODESTYLE.md — user-facing
 * text is Spanish; code and identifiers are English). A second language later is a
 * second file, not a refactor (ROADMAP.md A11).
 */
const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export const copy = {
  poweredBy: 'Desarrollado con TuBus',
  routesHeading: 'Rutas',
  routesSubheading: 'Elegí una ruta para ver los buses en vivo.',
  noRoutes: 'Todavía no hay rutas publicadas',
  noRoutesHint: 'Esta empresa aún no ha publicado ninguna ruta activa.',
  noActiveBusesShort: 'Sin buses',
  stopsHeading: 'Paradas',
  scheduleHeading: 'Horarios',
  scheduleEmpty: 'No hay horarios programados para esta dirección.',
  directionHeading: 'Dirección',
  busesHeading: 'Buses en esta ruta',
  liveState: {
    LIVE: 'En vivo',
    STALE: 'Actualizado hace un momento',
    OFFLINE: 'Sin señal',
  },
  connectionDegraded: 'Sin conexión en tiempo real — actualizando cada 10 segundos.',
  connectionRestored: 'Conexión en tiempo real restablecida.',
  noActiveBuses: 'Ningún bus está circulando esta ruta en este momento.',
  noActiveBusesHint: 'Los buses aparecerán aquí en cuanto un conductor inicie un viaje.',
  companyNotFound: 'No se encontró ninguna empresa en esta dirección.',
  routeNotFound: 'No se encontró esta ruta.',
  updatedJustNow: 'actualizado justo ahora',
  updatedSecondsAgo: (n: number) => `actualizado hace ${n} segundos`,
  updatedMinutesAgo: (n: number) => `actualizado hace ${n} ${n === 1 ? 'minuto' : 'minutos'}`,
  share: 'Compartir ruta',
  shareCopied: 'Enlace copiado al portapapeles',
  backToRoutes: 'Volver a rutas',
  viewOnMap: 'Ver en el mapa',
  speedLabel: (kmh: number) => `${kmh} km/h`,
  daysOfWeek: (days: number[]): string => {
    if (days.length === 7) return 'Todos los días';
    const sorted = [...days].sort((a, b) => a - b);
    if (sorted.join(',') === '1,2,3,4,5') return 'Lunes a viernes';
    if (sorted.join(',') === '0,6') return 'Fines de semana';
    return sorted.map((d) => DAY_NAMES[d]).join(', ');
  },
};
