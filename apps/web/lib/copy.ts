/**
 * All passenger and driver-facing strings in one dictionary (CODESTYLE.md — user-facing
 * text is Spanish; code and identifiers are English). A second language later is a
 * second file, not a refactor (ROADMAP.md A11).
 */
export const copy = {
  poweredBy: 'Desarrollado con TuBus',
  routesHeading: 'Rutas',
  noRoutes: 'Esta empresa aún no ha publicado rutas.',
  stopsHeading: 'Paradas',
  liveState: {
    LIVE: 'En vivo',
    STALE: 'Actualizado hace un momento',
    OFFLINE: 'Sin señal',
  },
  connectionDegraded: 'Conexión en tiempo real no disponible — actualizando cada 10 segundos.',
  noActiveBuses: 'Ningún bus está circulando esta ruta en este momento.',
  companyNotFound: 'No se encontró ninguna empresa en esta dirección.',
  routeNotFound: 'No se encontró esta ruta.',
  updatedJustNow: 'actualizado justo ahora',
  updatedSecondsAgo: (n: number) => `actualizado hace ${n} segundos`,
  updatedMinutesAgo: (n: number) => `actualizado hace ${n} ${n === 1 ? 'minuto' : 'minutos'}`,
};
