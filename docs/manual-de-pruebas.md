# Manual de pruebas — TuBus

Guía paso a paso para probar el proyecto completo en tu PC: el sitio del pasajero, el
panel administrativo, el simulador de buses, y la app del chofer en un celular real
(incluyendo probarla fuera de casa, con datos móviles, sin cable USB).

No necesitás saber programar para seguir esto — son comandos para copiar y pegar.

---

## 0. Lo que vas a necesitar instalado

| Herramienta                | Para qué                                               | Ya la tenés si…                             |
| -------------------------- | ------------------------------------------------------ | ------------------------------------------- |
| **PostgreSQL** (nativo)    | La base de datos                                       | Ya lo instalaste                            |
| **Node.js 20+** y **pnpm** | Corre el backend y el sitio web                        | `node -v` en una terminal te da `v20` o más |
| **Android Studio**         | Solo si vas a reinstalar/reconstruir la app del chofer | —                                           |
| **ngrok**                  | Solo para probar la app del chofer lejos de casa       | Ya está instalado en esta PC                |

> Docker ya no hace falta para nada en este manual — todo corre contra tu PostgreSQL
> instalado directamente en Windows. Si preferís volver a usar Docker para la base de
> datos más adelante, la sección **Solución de problemas** explica cómo.

Todos los comandos van en una terminal (PowerShell) abierta en la carpeta del proyecto:

```powershell
cd "C:\Users\Andrey\Documents\Proyectos FREELANCE\PorDondeVa"
```

---

## 1. Verificar la base de datos

Este proyecto usa una base llamada `tubus` en tu PostgreSQL local (puerto **5433**,
usuario `postgres`). Confirmá que el servicio está corriendo:

```powershell
Get-Service postgresql-x64-18
```

Si dice `Stopped`, iniciálo con:

```powershell
Start-Service postgresql-x64-18
```

> Si tu instalación quedó con otro nombre de servicio o en otro puerto,
> `Get-Service postgresql*` los lista todos, y
> `netstat -ano | findstr ":5433"` te confirma qué proceso está escuchando en cada
> puerto. Ajustá el puerto en el resto de este manual si el tuyo es distinto.

---

## 2. Instalar dependencias y preparar la base de datos

Solo la primera vez (o si borraste `node_modules`):

```powershell
pnpm install
```

Creá la base de datos una sola vez (si ya existe, este comando no hace nada malo):

```powershell
$env:PGPASSWORD = "Andrey0305#"
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -h localhost -p 5433 -U postgres -c "CREATE DATABASE tubus;"
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -h localhost -p 5433 -U postgres -d tubus -c "CREATE EXTENSION IF NOT EXISTS citext;"
```

Aplicar la estructura de la base de datos y cargarla con datos de ejemplo (empresa,
buses, conductores, una ruta con paradas y horarios):

```powershell
$env:DATABASE_URL = "postgresql://postgres:Andrey0305%23@localhost:5433/tubus?schema=public"
pnpm --filter api exec prisma migrate deploy
pnpm --filter api exec ts-node prisma/seed.ts
```

> El `%23` en la URL es tu `#` "escapado" — así tiene que ir siempre que uses esta
> contraseña dentro de una `DATABASE_URL`.

Al final va a imprimir las credenciales de prueba. Guardalas — las vas a usar todo el
manual:

```
password: ChangeMe123!
super admin: super@tubus.dev

RutaEjemplo (empresa de ejemplo, código: rutaejemplo):
  company admin: admin@rutaejemplo.dev
  operator: operator@rutaejemplo.dev
  drivers: driver24, driver31

Andrey (para tus pruebas de campo con celular, código: andrey):
  company admin: admin@andrey.dev
  driver: prueba1
```

> El seed crea **dos** empresas. **RutaEjemplo** es de ejemplo/prueba — no es una
> empresa real — y tiene dos rutas reales de Tuan R.L. (usadas solo como datos de
> prueba, no afiliadas a esa empresa): _Alajuela ↔ Naranjo_ y _Grecia ↔ San José_.
> **Andrey** es una segunda empresa pensada para tus pruebas de campo (instalar la app
> en un celular real y salir a caminar/manejar) — no tiene una ruta con trazado real,
> porque lo que te interesa ahí es el recorrido que efectivamente hizo el celular (ver
> el paso 6, "Viajes" → el detalle de un viaje dibuja el recorrido real, no la ruta
> preestablecida).

> Si en algún momento algo se ve "roto" o con datos raros (por ejemplo de pruebas
> anteriores), podés reiniciar todo desde cero repitiendo este paso — `seed.ts` no
> duplica nada. Si querés empezar 100% limpio (borrar todos los datos), corré primero
> `& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -h localhost -p 5433 -U postgres -c "DROP DATABASE tubus;"`
> y luego repetí el bloque de arriba desde `CREATE DATABASE`.

---

## 3. Levantar el backend y el sitio web

Abrí **dos** terminales (dejalas corriendo, no las cierres).

**Terminal A — backend:**

```powershell
$env:DATABASE_URL = "postgresql://postgres:Andrey0305%23@localhost:5433/tubus?schema=public"
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
http://rutaejemplo.localhost:3000
```

> `*.localhost` funciona automáticamente en Chrome, Edge y Firefox — no hace falta
> configurar nada.

Deberías ver la página de la empresa "RutaEjemplo" con las rutas "Alajuela ↔ Naranjo"
y "Grecia ↔ San José". Entrá a una ruta y vas a ver el mapa, la lista de paradas y los
horarios. Todavía no hay ningún bus circulando — eso es lo siguiente.

---

## 5. Ver un bus moviéndose (simulador)

En una tercera terminal:

```powershell
pnpm simulate --route alajuela-naranjo --bus "Bus 24" --speed 60
```

Volvé a la pestaña del navegador con la ruta abierta — en unos segundos el bus va a
aparecer en el mapa y empezar a moverse. Podés tocar la tarjeta del bus para que el
mapa se centre en él, o cambiar de dirección con el selector "Hacia Naranjo / Hacia
Alajuela".

Para simular una pérdida de señal y su recuperación:

```powershell
pnpm simulate --route alajuela-naranjo --bus "Bus 31" --speed 60 --drop-network-after 30 --reconnect-after 60
```

`Ctrl+C` en esa terminal detiene el bus (el viaje queda activo pero sin señal — así se
comporta un bus real que se apagó sin cerrar el viaje).

---

## 6. Probar el panel administrativo

Abrí:

```
http://admin.tubus.localhost:3000
```

Iniciá sesión con `admin@rutaejemplo.dev` / `ChangeMe123!`. Desde ahí podés:

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
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" install -r app\build\outputs\apk\debug\app-debug.apk
```

> Si preferís poder escribir simplemente `adb` sin la ruta completa: buscá "Editar las
> variables de entorno del sistema" en el menú de inicio → botón **Variables de
> entorno** → en "Variables de usuario", seleccioná `Path` → **Editar** → **Nuevo** →
> pegá `%LOCALAPPDATA%\Android\Sdk\platform-tools`. Cerrá y volvé a abrir la terminal
> para que tome efecto. (Evitá hacer esto por línea de comandos con `setx` — puede
> truncar el PATH si es muy largo.)

### 7.4 Usarla sin cable

Desconectá el USB. Abrí la app "TuBus Conductor" en el celular — funciona con datos
móviles o wifi, no importa cuál, porque ya sabe hablarle a la URL pública de ngrok en
lugar de a tu red local. Iniciá sesión con la empresa **Andrey** — es la que existe
específicamente para esto: no tiene una ruta real preestablecida, así que lo que
importa es el recorrido que el celular efectivamente hizo, no una ruta dibujada de
antemano:

- **Código de empresa:** `andrey`
- **Usuario:** `prueba1`
- **Contraseña:** `ChangeMe123!`

Elegí "Recorrido libre" y tocá **Iniciar viaje**. A partir de ahí podés meter el
celular en el carro (o dárselo a alguien más para que camine/viaje con él) y salir —
mientras la PC siga prendida, el backend siga corriendo, y la terminal de ngrok siga
abierta, las posiciones van a llegar. Para ver el recorrido en tiempo real (o después,
ya terminado), entrá al panel administrativo (paso 6) con `admin@andrey.dev` /
`ChangeMe123!` → **Flota en vivo** mientras está en curso, o **Viajes** → el viaje en
cuestión para ver el recorrido real dibujado sobre el mapa una vez finalizado. Ahí
mismo vas a poder notar cualquier corte de señal (huecos en el trazado, o el estado
"Sin señal") si el celular perdió cobertura en el camino.

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

## 8. Solución de problemas con PostgreSQL

Si algún comando de este manual no puede conectarse a la base de datos:

1. Confirmá que el servicio está corriendo: `Get-Service postgresql*`. Si está
   `Stopped`, arrancálo con `Start-Service postgresql-x64-18` (o el nombre que te haya
   quedado a vos).
2. Confirmá que está escuchando en el puerto que esperás:
   `netstat -ano | findstr ":5433"` (o el puerto que corresponda). Si tenés más de una
   versión de PostgreSQL instalada, cada una suele quedar en un puerto distinto — usá
   el puerto real en vez del `5433` de este manual si son diferentes.
3. Si la contraseña cambió o no es la que aparece en este manual, actualizá el
   `DATABASE_URL` en cada comando (y en el archivo `.env` del proyecto) con la
   contraseña correcta — recordá "escapar" cualquier `#` como `%23` dentro de la URL.
4. Si preferís volver a usar Docker en lugar de tu PostgreSQL nativo, `docker compose
up -d` sigue funcionando igual que antes — solo recordá que el `docker-compose.yml`
   de este proyecto expone Postgres en el puerto `5432`, así que usarías
   `DATABASE_URL=postgresql://tubus:tubus@localhost:5432/tubus?schema=public` en su
   lugar (y necesitás Docker Desktop corriendo).

---

## 9. Referencia rápida de credenciales

| Rol                                       | Usuario                                  | Contraseña     |
| ----------------------------------------- | ---------------------------------------- | -------------- |
| Super admin (plataforma)                  | `super@tubus.dev`                        | `ChangeMe123!` |
| **RutaEjemplo** — admin                   | `admin@rutaejemplo.dev`                  | `ChangeMe123!` |
| **RutaEjemplo** — operador                | `operator@rutaejemplo.dev`               | `ChangeMe123!` |
| **RutaEjemplo** — conductor 1             | código `rutaejemplo`, usuario `driver24` | `ChangeMe123!` |
| **RutaEjemplo** — conductor 2             | código `rutaejemplo`, usuario `driver31` | `ChangeMe123!` |
| **Andrey** (pruebas de campo) — admin     | `admin@andrey.dev`                       | `ChangeMe123!` |
| **Andrey** (pruebas de campo) — conductor | código `andrey`, usuario `prueba1`       | `ChangeMe123!` |

Todas son credenciales de desarrollo — no existen en ningún ambiente real.

---

## 10. Apagar todo al terminar

No hace falta apagar PostgreSQL — es un servicio de Windows y no molesta corriendo en
segundo plano. Si igual querés detenerlo:

```powershell
Stop-Service postgresql-x64-18
```

Los datos quedan intactos para la próxima vez. Las terminales del backend, el sitio
web, el simulador y ngrok se cierran con `Ctrl+C` o cerrando la ventana.
