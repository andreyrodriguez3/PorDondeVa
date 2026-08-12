# Manual de pruebas — TuBus

Guía paso a paso para probar el proyecto completo en tu PC: el sitio del pasajero, el
panel administrativo, el simulador de buses, y la app del chofer en un celular real
(incluyendo probarla fuera de casa, con datos móviles, sin cable USB).

No necesitás saber programar para seguir esto — son comandos para copiar y pegar.

---

## 0. Lo que vas a necesitar instalado

| Herramienta                | Para qué                                                 | Ya la tenés si…                                                   |
| -------------------------- | -------------------------------------------------------- | ----------------------------------------------------------------- |
| **Docker Desktop**         | Corre la base de datos (y opcionalmente todo el backend) | Podés abrir Docker Desktop y ves la ballena en la barra de tareas |
| **Node.js 20+** y **pnpm** | Corre el backend y el sitio web fuera de Docker          | `node -v` en una terminal te da `v20` o más                       |
| **Android Studio**         | Solo si vas a reinstalar/reconstruir la app del chofer   | —                                                                 |
| **ngrok**                  | Solo para probar la app del chofer lejos de casa         | Ya está instalado en esta PC                                      |

Todos los comandos van en una terminal (PowerShell) abierta en la carpeta del proyecto:

```powershell
cd "C:\Users\Andrey\Documents\Proyectos FREELANCE\PorDondeVa"
```

---

## 1. Levantar la base de datos

```powershell
docker compose up -d
```

Esto solo levanta Postgres (rápido). Si Docker Desktop no arranca o da error, revisá la
sección **Solución de problemas** al final. Mientras Postgres esté corriendo en algún
lado (aunque sea de una sesión anterior), podés saltarte este paso.

Confirmá que está sano:

```powershell
docker ps
```

Deberías ver un contenedor `postgres` con estado `healthy`.

---

## 2. Instalar dependencias y preparar la base de datos

Solo la primera vez (o si borraste `node_modules`):

```powershell
pnpm install
```

Aplicar la estructura de la base de datos y cargarla con datos de ejemplo (empresa,
buses, conductores, una ruta con paradas y horarios):

```powershell
$env:DATABASE_URL = "postgresql://tubus:tubus@localhost:5432/tubus?schema=public"
pnpm --filter api exec prisma migrate deploy
pnpm --filter api exec ts-node prisma/seed.ts
```

Al final va a imprimir las credenciales de prueba. Guardalas — las vas a usar todo el
manual:

```
password: ChangeMe123!
super admin: super@tubus.dev
company admin: admin@tuanrl.dev
operator: operator@tuanrl.dev
drivers: driver24, driver31 (código de empresa: tuanrl)
```

> Si en algún momento algo se ve "roto" o con datos raros (por ejemplo de pruebas
> anteriores), podés reiniciar todo desde cero repitiendo este paso — `seed.ts` no
> duplica nada, y si querés empezar 100% limpio primero corré
> `docker compose down -v && docker compose up -d` para borrar el volumen de la base de
> datos.

---

## 3. Levantar el backend y el sitio web

Abrí **dos** terminales (dejalas corriendo, no las cierres).

**Terminal A — backend:**

```powershell
$env:DATABASE_URL = "postgresql://tubus:tubus@localhost:5432/tubus?schema=public"
$env:JWT_ACCESS_SECRET = "un-secreto-de-al-menos-16-caracteres"
$env:JWT_REFRESH_SECRET = "otro-secreto-de-al-menos-16-caracteres"
$env:ACCESS_TOKEN_TTL = "15m"
$env:REFRESH_TOKEN_TTL = "30d"
$env:PLATFORM_DOMAIN = "tubus.localhost"
$env:ADMIN_HOST = "admin.tubus.localhost"
pnpm --filter api dev
```

Esperá a ver `Found 0 errors. Watching for file changes.` — el backend ya está arriba
en `http://localhost:8080`.

**Terminal B — sitio web:**

```powershell
$env:PUBLIC_API_URL = "http://localhost:8080"
$env:NEXT_PUBLIC_WS_URL = "ws://localhost:8080"
$env:ADMIN_HOST = "admin.tubus.localhost"
pnpm --filter web dev
```

Esperá a ver `Ready`. El sitio ya está en `http://localhost:3000`.

---

## 4. Probar el sitio del pasajero

Abrí en el navegador:

```
http://tuanrl.localhost:3000
```

> `*.localhost` funciona automáticamente en Chrome, Edge y Firefox — no hace falta
> configurar nada.

Deberías ver la página de la empresa "Tuan RL" con la ruta "San José → Palmares".
Entrá a la ruta y vas a ver el mapa, la lista de paradas y los horarios. Todavía no hay
ningún bus circulando — eso es lo siguiente.

---

## 5. Ver un bus moviéndose (simulador)

En una tercera terminal:

```powershell
pnpm simulate --route sanjose-palmares --bus "Bus 24" --speed 60
```

Volvé a la pestaña del navegador con la ruta abierta — en unos segundos el bus va a
aparecer en el mapa y empezar a moverse. Podés tocar la tarjeta del bus para que el
mapa se centre en él, o cambiar de dirección con el selector "Hacia Palmares / Hacia
San José".

Para simular una pérdida de señal y su recuperación:

```powershell
pnpm simulate --route sanjose-palmares --bus "Bus 31" --speed 60 --drop-network-after 30 --reconnect-after 60
```

`Ctrl+C` en esa terminal detiene el bus (el viaje queda activo pero sin señal — así se
comporta un bus real que se apagó sin cerrar el viaje).

---

## 6. Probar el panel administrativo

Abrí:

```
http://admin.tubus.localhost:3000
```

Iniciá sesión con `admin@tuanrl.dev` / `ChangeMe123!`. Desde ahí podés:

- **Flota en vivo** — mapa con todos los buses circulando ahora.
- **Viajes** — historial completo; entrá a uno para ver su recorrido dibujado en el
  mapa y, si está activo, finalizarlo.
- **Buses / Conductores / Rutas / Paradas** — altas y bajas.
- **Rutas → (una ruta)** — variantes direccionales, sus paradas y horarios.
- **Códigos QR** — un QR por ruta y uno general de la empresa, listos para descargar e
  imprimir.
- **Configuración** — nombre, logo, color de marca, umbrales de "en vivo"/"sin señal",
  y dominios propios.

---

## 7. Probar la app del chofer en tu celular (sin cable, fuera de casa)

Esta es la parte que te interesa: instalar la app una sola vez por USB, y después
poder usarla con datos móviles, lejos de la PC — mientras la PC se quede prendida y
conectada a internet en casa.

### 7.1 Exponer tu backend a internet con ngrok

Mientras el backend (Terminal A) sigue corriendo, abrí otra terminal:

```powershell
ngrok http 8080
```

Vas a ver algo así:

```
Forwarding    https://a1b2-c3d4-e5f6.ngrok-free.app -> http://localhost:8080
```

Copiá esa URL `https://....ngrok-free.app` — es la dirección pública de tu backend.
**Dejá esa terminal abierta**: si la cerrás, la app deja de poder conectarse.

> La versión gratuita de ngrok genera una URL distinta cada vez que la reiniciás. Si
> cerrás y volvés a abrir `ngrok http 8080` en otro día, vas a tener que repetir el
> paso 7.2 con la nueva URL.

### 7.2 Compilar la app con esa dirección

```powershell
cd android
.\gradlew.bat assembleDebug "-PapiBaseUrl=https://a1b2-c3d4-e5f6.ngrok-free.app/"
```

(Reemplazá la URL por la que te dio ngrok — **con la barra `/` al final**, es
importante.)

### 7.3 Instalar en el celular

Conectá el celular por USB una sola vez, con "Depuración USB" activada en Opciones de
desarrollador:

```powershell
adb install -r app\build\outputs\apk\debug\app-debug.apk
```

### 7.4 Usarla sin cable

Desconectá el USB. Abrí la app "TuBus Conductor" en el celular — funciona con datos
móviles o wifi, no importa cuál, porque ya sabe hablarle a la URL pública de ngrok en
lugar de a tu red local. Iniciá sesión:

- **Código de empresa:** `tuanrl`
- **Usuario:** `driver24` (o `driver31`)
- **Contraseña:** `ChangeMe123!`

Elegí una ruta y tocá **Iniciar viaje**. A partir de ahí podés meter el celular en el
carro y salir a manejar — mientras la PC siga prendida, el backend siga corriendo, y
la terminal de ngrok siga abierta, las posiciones van a llegar. Abrí
`http://tuanrl.localhost:3000/r/sanjose-palmares` desde otra PC o celular (en la misma
red que tu PC, o usando la misma URL de ngrok apuntada al puerto del sitio web si
querés verlo desde afuera también) para verte a vos mismo moviéndote en el mapa.

> **Si además querés ver el sitio del pasajero desde el celular, fuera de tu red
> wifi de casa:** abrí una segunda terminal de ngrok para el sitio web:
> `ngrok http 3000`, y en el celular usá esa URL en lugar de `tuanrl.localhost:3000`
> (vas a necesitar loguearte o navegar directo a `/r/sanjose-palmares` en esa URL).

### 7.5 Mantener la PC despierta

Windows por defecto suspende la PC tras un rato de inactividad, lo que cortaría todo.
Mientras hagas esta prueba, desactivá la suspensión:

**Configuración → Sistema → Energía → Pantalla y suspensión → nunca**, o desde
PowerShell (como administrador):

```powershell
powercfg /change standby-timeout-ac 0
```

Acordate de devolverlo a su valor normal cuando termines de probar.

---

## 8. Solución de problemas con Docker

Si `docker compose up -d` falla o Docker Desktop no arranca:

1. Abrí Docker Desktop manualmente desde el menú de inicio y esperá a que la ballena
   deje de animarse (significa que ya inició).
2. Si sigue sin responder, reiniciá el servicio:
   ```powershell
   Restart-Service com.docker.service
   ```
   (puede pedir permisos de administrador).
3. Si nada de eso funciona, no hace falta Docker para nada más que Postgres. Como
   alternativa, instalá PostgreSQL 16 directo en Windows
   (https://www.postgresql.org/download/windows/), creá una base `tubus` con usuario
   `tubus`/contraseña `tubus`, y usá
   `DATABASE_URL=postgresql://tubus:tubus@localhost:5432/tubus?schema=public` igual que
   arriba — el resto del manual no cambia.

---

## 9. Referencia rápida de credenciales

| Rol                         | Usuario                             | Contraseña     |
| --------------------------- | ----------------------------------- | -------------- |
| Super admin (plataforma)    | `super@tubus.dev`                   | `ChangeMe123!` |
| Administrador de la empresa | `admin@tuanrl.dev`                  | `ChangeMe123!` |
| Operador                    | `operator@tuanrl.dev`               | `ChangeMe123!` |
| Conductor 1                 | código `tuanrl`, usuario `driver24` | `ChangeMe123!` |
| Conductor 2                 | código `tuanrl`, usuario `driver31` | `ChangeMe123!` |

Todas son credenciales de desarrollo — no existen en ningún ambiente real.

---

## 10. Apagar todo al terminar

```powershell
docker compose down
```

Esto detiene Postgres sin borrar los datos (la próxima vez que hagas
`docker compose up -d` van a seguir ahí). Si preferís borrar todo y empezar de cero la
próxima vez: `docker compose down -v`. Las terminales del backend, el sitio web, el
simulador y ngrok se cierran con `Ctrl+C` o cerrando la ventana.
