# Pocket Manager

PWA de uso personal para preparar y revisar publicaciones de KTsoftware y Etiquétame. La publicación en Instagram/TikTok sigue siendo manual.

Cada publicación conserva los campos de la planilla de su marca por separado (gancho, guion, caption, hashtags, CTA, tema, serie, fecha/hora y datos de origen). En "Campos del Excel" cada valor dispone de su botón **Copiar**, además del botón para copiar caption y hashtags juntos.

## Desarrollo local

1. Crea un proyecto Supabase **de prueba** y copia `.env.example` como `.env.local` (o completa el `.env.local` que ya tienes).
2. Completa la clave `service_role` y el PIN privado. La clave `service_role` solo se utiliza en el servidor y en el seed; no la pongas bajo `NEXT_PUBLIC_`. `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` es una clave pública y no reemplaza la clave `service_role` en esta app.
3. Aplica `supabase/migrations/20261021_init_schema.sql` una sola vez desde el SQL Editor del proyecto. La migración deja el bucket `media` privado y bloquea el acceso Data API de `anon` y `authenticated`; la app usa el cliente privilegiado exclusivamente tras validar su cookie de sesión.
4. Instala dependencias si aún no están instaladas y ejecuta:

   ```bash
   npm run seed:check
   npm run seed
   npm test
   npm run build
   npm run dev
   ```

   `seed:check` valida ZIP, calendarios, datos y archivos sin escribir en Supabase. `seed` requiere URL y `service_role` key; sube los medios al bucket privado, registra las rutas relativas y preserva estados publicados y enlaces de audio resueltos en reimportaciones.
5. Abre la dirección local mostrada por Next.js. Inicia sesión con el PIN que configuraste. Para instalarla en el móvil, usa “Añadir a pantalla de inicio” desde un navegador compatible.

No guardamos respuestas API, publicaciones ni medios en caché offline. Sin conexión se muestra una pantalla informativa; la PWA no permite operar con datos desactualizados.

## Acceso y medios

- Todas las rutas de datos verifican la cookie firmada `HttpOnly`; las mutaciones de post aceptan solo estados válidos y enlaces HTTPS.
- El `service_role` key no se envía al navegador. Los assets se sirven a través de una ruta autenticada que genera un enlace firmado privado de vida corta y lo transmite sin almacenar la respuesta en caché.
- La migración está pensada para inicializar un proyecto de prueba vacío. Si ya aplicaste una versión previa de esta migración, revisa las políticas y el bucket del proyecto antes de desplegar; editar el archivo local no cambia automáticamente una base ya migrada.
- No se realiza publicación automática, ni se garantiza que el menú de compartir abra directamente Instagram/TikTok.

## Variables

`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ACCESS_PIN`, `SESSION_SECRET`, `MEDIA_BUCKET` y `APP_TIME_ZONE` se describen en `.env.example`. No compartas ni subas `.env.local`.
