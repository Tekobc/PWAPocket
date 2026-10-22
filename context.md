|# Pocket Manager PWA - Master Specification & Context

Documento maestro de especificación y arquitectura técnica para el desarrollo de la Progressive Web App (PWA) **Pocket Manager**.

---

## 1. Visión General del Proyecto

**Pocket Manager** es una PWA *mobile-first* diseñada exclusivamente para uso personal (un solo operador). Su objetivo es optimizar y agilizar al máximo el flujo de trabajo manual para revisar, preparar y publicar contenido en redes sociales (Instagram/TikTok) para dos marcas:
1. **KTsoftware** (desarrollo de software y tecnología B2B).
2. **Etiquétame** (`etiquetame.ok` - diseño, papelería y etiquetas personalizadas B2C).

> **Premisa Fundamental:** La aplicación **no** interactúa con las APIs públicas ni privadas de publicación automática de Meta ni de TikTok. El flujo es 100% manual asistido desde el teléfono móvil, enfocado en eliminar la fricción entre los archivos generados y la publicación final.

### Flujo Operativo Clave (Móvil)
$$\text{Abrir PWA} \longrightarrow \text{Ver "Hoy y Mañana"} \longrightarrow \text{Copiar Copy (1 clic)} \longrightarrow \text{Compartir/Descargar Media} \longrightarrow \text{Abrir Audio (opcional)} \longrightarrow \text{Marcar "Publicado"}$$

---

## 2. Identidad de Marcas y Contenidos

| Parámetro | **KTsoftware** | **Etiquétame** |
| :--- | :--- | :--- |
| **Audiencia** | B2B, programadores, empresas | B2C, emprendedores, familias, eventos |
| **Identidad Visual** | Minimalista, tecnológica, estética developer | Lúdica, amigable, artesanal, cálida |
| **Paleta de Acentos** | Azul tecnológico, cian, dark navy | Amarillo, turquesa, crema |
| **Tipografías de Marca** | Jost, JetBrains Mono | Bagel Fat One, Poppins |
| **Formatos en Kit** | Carruseles (4:5), Reels MP4 (9:16), Portadas | Carruseles (4:5), Reels MP4 (9:16), Historias (9:16) con stickers |
| **Cadencia de Publicación** | 22 piezas / mes (Reels lun/vie, Carruseles mié, Historias mar/jue/sáb) | 22 piezas / mes (Reels lun/vie, Carruseles mié, Historias mar/jue/sáb) |

---

## 3. Formatos de Contenido y Reglas de Negocio

El modelo de datos y la interfaz de usuario distinguen explícitamente tres formatos de publicación:

### 1. Carrusel (`carrusel`)
* **Archivos asociados:** Secuencia ordenada de imágenes PNG (`_01.png`, `_02.png`, `_03.png`, ...).
* **Comportamiento en UI:**
  * Visor deslizable tipo carrusel con indicador de página (ej. `1/5`) y vista previa en ratio 4:5.
  * Botón de descarga/compartir: utiliza la Web Share API para adjuntar todos los slides en orden al menú nativo de compartir, con *fallback* de descarga secuencial/directa al almacenamiento del celular.

### 2. Reel (`reel`)
* **Archivos asociados:** 
  1. Archivo de video principal (`.mp4`).
  2. Imagen de portada / thumbnail (`salida/REELS-MES1/...`).
* **Comportamiento en UI:**
  * Reproductor de video integrado para revisión previa rápida del clip + preview de la portada seleccionada.
  * Botón de descarga/compartir del video MP4.
  * Botón para abrir el link del audio en tendencia de Instagram/TikTok (si está definido).
  * Si el audio no está cargado (`pending_audio`), muestra un botón rápido de "Pegar link de audio" in-situ.

### 3. Historia (`historia`)
* **Archivos asociados:** Imagen individual en relación de aspecto 9:16.
* **Comportamiento en UI:**
  * Vista previa vertical en 9:16.
  * Si el contenido original especifica una "zona" para sticker/pregunta de Instagram, muestra un indicador visual informativo para el operador.
  * Botón de descarga/compartir al carrete para subir a Historias de Instagram.

---

## 4. Arquitectura y Stack Tecnológico

* **Frontend:** [Next.js](https://nextjs.org/) (App Router, React, TypeScript). Usar la versión compatible con las dependencias instaladas; no asumir React 19 hasta verificarlo.
* **Estilos:** Tailwind CSS con clases de diseño táctil (`min-h-[44px]`, `touch-manipulation`) y contrastes elevados para exteriores.
* **Iconografía:** `lucide-react`.
* **PWA:** elegir una sola solución de Service Worker compatible con la versión de Next.js del proyecto. Incluir Web App Manifest, `display: standalone`, iconos y caché offline de recursos estáticos. No almacenar en caché respuestas privadas ni datos mutables sin una política de invalidación explícita.
* **Backend y Base de Datos:** [Supabase](https://supabase.com/) (PostgreSQL Cloud + Supabase Storage para multimedia).
* **Despliegue:** [Vercel](https://vercel.com/) (conectado al repositorio Git).
* **Seguridad y Control de Acceso:** PIN validado exclusivamente en el servidor usando `ACCESS_PIN`, variable privada de entorno. Nunca exponerlo mediante `NEXT_PUBLIC_*`. La sesión se representa con una cookie firmada, `HttpOnly`, `Secure` en producción y `SameSite=Lax`; el PIN no se guarda en el navegador. `localStorage` solo puede recordar preferencias de interfaz, no actuar como autenticación.

El PIN funciona como una barrera de acceso de una sola persona, no como identidad multiusuario ni como sustituto de controles de acceso en Supabase. Las rutas que leen o modifican datos deben exigir una sesión válida. La clave `service_role` de Supabase solo se usa en código de servidor y nunca se incluye en bundles del cliente.

---

## 5. Modelo de Datos (Esquema PostgreSQL en Supabase)

```sql
-- Habilitar extensión UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Tabla de Espacios de Trabajo (Workspaces)
CREATE TABLE workspaces (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug VARCHAR(50) UNIQUE NOT NULL,      -- 'ktsoftware', 'etiquetame'
    name VARCHAR(100) NOT NULL,            -- 'KTsoftware', 'Etiquétame'
    accent_color VARCHAR(30) NOT NULL,     -- Código HEX o clase Tailwind
    badge_label VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Tipos Enums para Formatos y Estados
CREATE TYPE post_format AS ENUM ('carrusel', 'reel', 'historia');
CREATE TYPE post_status AS ENUM ('pending_audio', 'ready', 'published');

-- 3. Tabla de Publicaciones (Posts)
CREATE TABLE posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    code_id VARCHAR(50) NOT NULL,          -- Ej: 'S1-01', 'S1-03', 'S2-05'
    format post_format NOT NULL,
    scheduled_date DATE NOT NULL,
    scheduled_time TIME,                   -- Hora civil del calendario, en APP_TIME_ZONE
    source_week INTEGER,
    source_weekday TEXT,
    source_level TEXT,
    series TEXT,
    theme TEXT,
    hook TEXT,
    script TEXT,
    caption_text TEXT,
    hashtags TEXT,
    cta TEXT,
    source_files TEXT,
    source_status TEXT,
    copy_text TEXT NOT NULL DEFAULT '',
    audio_url TEXT,                        -- Enlace al audio de IG/TikTok
    status post_status NOT NULL DEFAULT 'ready',
    notes TEXT,                            -- Notas adicionales o zonas de stickers
    published_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (workspace_id, code_id),
    CHECK (status <> 'pending_audio' OR format = 'reel')
);

-- 4. Tabla de Recursos Multimedia (Post Assets)
CREATE TABLE post_assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    asset_type VARCHAR(20) NOT NULL CHECK (asset_type IN ('image', 'video', 'cover')),
    storage_path TEXT NOT NULL,            -- Ruta en el bucket Supabase Storage
    public_url TEXT,                       -- dejar NULL para el bucket privado; no guardar URLs firmadas temporales
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (post_id, asset_type, order_index)
);

-- Índices para consultas eficientes en el móvil
CREATE INDEX idx_posts_workspace_date ON posts(workspace_id, scheduled_date);
CREATE INDEX idx_posts_workspace_status_date ON posts(workspace_id, status, scheduled_date);
CREATE INDEX idx_post_assets_post_order ON post_assets(post_id, order_index ASC);
```

`updated_at` debe actualizarse en cada modificación mediante un trigger o desde una única capa de escritura confiable. Al marcar un post como `published`, guardar la hora en `published_at TIMESTAMPTZ` (añadirla a la migración); al volver a otro estado, limpiar esa fecha. `ready` significa que la pieza está preparada para publicarse, no que ya esté publicada. Una pieza atrasada pendiente de audio también debe aparecer en el conteo de atrasadas, además del conteo de audios pendientes.

Las fechas del calendario son fechas civiles locales (`DATE`), no instantes UTC. Comparar `scheduled_date` con la fecha actual en la zona horaria configurada para el operador; no aplicar conversiones UTC que desplacen una pieza de día. La hora de la planilla se conserva en `scheduled_time TIME` y se interpreta en `APP_TIME_ZONE`, sin convertirla a UTC ni desplazarla de día.

El seed conserva por separado los campos de ambas planillas (semana, día, hora, nivel, serie/pilar, tema, gancho, guion/contenido, caption, hashtags, CTA, archivos y estado de origen). La tarjeta permite copiar cada campo de texto por separado; `copy_text` sigue siendo el bloque completo de caption más hashtags para el botón principal.

### Configuración de Supabase Storage
* **Bucket:** `media`. Decidir explícitamente si será público: un bucket público permite que cualquiera con la URL lea el contenido, aunque la app esté protegida por PIN. Si los archivos deben quedar privados, usar bucket privado y URLs firmadas de corta duración.
* **Estructura de Carpetas:**
  * `ktsoftware/carruseles/<code_id>/<code_id>_01.png` (un objeto por slide, orden ascendente).
  * `ktsoftware/reels/<code_id>.mp4` y `ktsoftware/covers/<code_id>.png`.
  * `ktsoftware/historias/<code_id>.png` cuando aplique.
  * La misma convención bajo `etiquetame/`.

Los `storage_path` son relativos a la raíz del bucket. `public_url` puede derivarse del bucket cuando sea público, pero nunca debe considerarse una autorización. Para buckets privados, generar URLs firmadas en el servidor cuando se soliciten; no persistir URLs firmadas temporales. Guardar el MIME type correcto y nombres de archivo estables; no sobrescribir objetos sin una estrategia de caché/versionado.

---

## 6. Proceso y Script de Migración Inicial (`npm run seed`)

El repositorio incluye un script ejecutable en Node.js/TypeScript (`scripts/seed.ts` o `scripts/seed.mjs`) que automatiza por completo la ingesta de los archivos existentes en la raíz del proyecto:

1. **Fuentes de Datos:**
   * Los cuatro ZIP están en la raíz del proyecto: `KT_Instagram_Plantillas.zip`, `KT_Reels_Mes1_MP4.zip`, `etiquetame_Instagram_Kit.zip` y `etiquetame_Reels_Mes1.zip`.
   * Los Excel `Calendario_Mes1_KTSoftware.xlsx` y `Calendario_Mes1_etiquetame.xlsx` están dentro de los ZIP de Instagram, no en la raíz.
   * Los kits de Instagram contienen `contenido/`, `salida/` y documentación `README.md`; los ZIP de reels contienen los MP4. El kit de Etiquétame también incluye `captions.md`.
2. **Acciones del Script:**
   * Valida que los cuatro archivos existan, que los ZIP abran correctamente y que cada kit tenga su Excel esperado. Informar errores con nombre de archivo y causa.
   * Lee el calendario con `xlsx`; identificar las hojas y encabezados reales antes de mapearlos. No depender de posiciones fijas de columna ni de nombres de hoja no verificados.
   * Usa la planilla como fuente canónica de fecha, formato, copy y audio cuando esos campos existan. Usa los JSON/README para asociar assets, notas de zona de sticker y convenciones de nombres. Si hay conflicto entre fuentes, detener esa fila y reportarlo; no sobrescribir silenciosamente.
   * Determina el formato mediante la columna de formato y/o el contenido de origen; el ID por sí solo no alcanza para distinguir una historia de una portada de reel.
   * Asigna `pending_audio` solo a reels sin una URL de audio válida. Los demás posts empiezan en `ready`.
   * Asocia slides de carrusel por nombre y orden numérico; asocia portadas `REELS-MES1/<code_id>.png` y video `<code_id>.mp4`; asocia historias con sus PNG individuales. No vincular una portada como video ni una historia como slide de carrusel.
   * Inserta o actualiza por `(workspace_id, code_id)` para permitir reejecución idempotente. No eliminar posts ni archivos de Storage que no estén en el manifiesto de entrada.
   * Genera un resumen con filas insertadas/actualizadas, assets cargados, omisiones y errores. La operación debe terminar con código distinto de cero si hubo errores que dejan datos incompletos.

`npm run seed` es una operación administrativa local, no una ruta pública. Las credenciales de escritura se leen desde variables privadas de entorno y no se imprimen en logs.

---

## 7. Experiencia de Usuario y Vistas de la PWA

El diseño de la interfaz está 100% optimizado para la mano y la pantalla del celular:

### 1. Pantalla de Acceso (PIN Gate)
* Teclado numérico o input de PIN simple (estilo código de bloqueo).
* El formulario envía el PIN a un endpoint de servidor por HTTPS. El servidor valida y crea la cookie de sesión; el cliente recibe solo el resultado, nunca el secreto.
* El endpoint limita intentos fallidos y usa respuestas genéricas. El PIN se rota mediante la configuración del entorno y no se incrusta en el repositorio.

### 2. Header Persistente
* **Workspace Switcher:** Toggle visual prominente ("KTsoftware" | "Etiquétame").
* Al alternar:
  * Cambian dinámicamente los colores de acento y logotipo.
  * Se filtran instantáneamente todas las vistas al workspace seleccionado.
* **Badge de Alerta:** Muestra pendientes de audio y publicaciones atrasadas sin publicar, sin contar dos veces un post que cumpla ambas condiciones.

### 3. Vista 1: Dashboard "Hoy y Mañana" (Principal)
* Muestra únicamente las tarjetas programadas para hoy y mañana en la zona horaria del operador. Si no hay piezas, presenta un estado vacío claro.
* **Banner de Atrasados:** Si hay publicaciones de fechas pasadas cuyo estado no sea `published`, muestra un colapsable: *"Tienes X publicaciones pasadas sin marcar"*.
* **Tarjeta de Publicación (Action Card):**
  * Badge del formato (Carrusel, Reel, Historia), fecha y hora programadas en la zona horaria del operador.
  * Contenedor visual:
    * *Carrusel:* Swipe horizontal de slides con paginador numérico.
    * *Reel:* Reproductor de video MP4 + miniatura de portada.
    * *Historia:* Visor vertical 9:16.
  * **Botón "Copiar Copy" (Primario):** Copia el texto completo al portapapeles del sistema operativo y muestra un *toast* o microanimación de éxito.
  * **Campos de calendario:** Mostrar los datos de origen (gancho, guion, caption, hashtags, CTA y notas, además de metadatos útiles) y ofrecer un botón "Copiar" por campo de texto.
  * **Botón "Compartir / Descargar Media":**
    * Invoca `navigator.share({ files })` solo en contexto seguro, desde un gesto del usuario y tras comprobar `navigator.canShare({ files })` cuando esté disponible.
    * Compartir abre el menú nativo del dispositivo; no garantiza que Instagram/TikTok se abra ni que acepte todos los formatos o tamaños.
    * *Fallback:* ofrecer enlaces de descarga/abrir por asset y explicar que el comportamiento depende del navegador. No prometer guardar directamente en la galería.
  * **Botón "Abrir Audio":** Visible si `audio_url` es una URL HTTPS válida. Abre el enlace externo; el sistema operativo decide si puede delegarlo en Instagram/TikTok.
  * **Acción Rápida de Audio Faltante:** Si el estado es `pending_audio`, muestra un campo/botón directo: *"Pegar Link de Audio"*, que actualiza Supabase al instante y conmuta el estado a `ready`.
  * **Selector de Estado Rápido:** Conmutador de 1 toque para cambiar a `published` (marcar como hecho).

### 4. Vista 2: Calendario / Planificación del Mes
* Accesible desde la barra de navegación inferior (Bottom Navigation).
* Permite explorar las 22 piezas del mes en formato de lista cronológica agrupada por semanas o cuadrícula mensual, con filtros rápidos (*Todos*, *Pendientes*, *Publicados*).

### 5. Vista 3: Auditoría de Audios Faltantes
* Lista focalizada que agrupa únicamente los posts en estado `pending_audio`.
* Permite resolver de un tirón todos los audios pendientes antes de que llegue el día de publicación.

---

## 8. Consideraciones Técnicas Móviles (Mobile-First Constraints)

1. **Áreas táctiles (Touch Targets):** Todos los botones e interactivos deben cumplir un alto y ancho mínimo de `44px` (`min-h-[44px]`).
2. **Uso bajo luz solar:** Paleta oscura con contrastes altos (texto blanco/zinc-100 sobre fondos oscuros neutros zinc-900/950) y acentos bien diferenciados.
3. **Caché y Rendimiento:** Las imágenes deben servirse con encabezados de caché adecuados a su política de actualización. Usar carga diferida en contenido fuera de pantalla y evitar diferir la imagen LCP principal.
4. **Prevención de Zoom accidental:** En inputs numéricos y de texto en iOS, mantener tamaño de fuente de al menos `16px` para evitar que Safari haga zoom automático en la pantalla.

---

## 9. Plan de Implementación por Fases

1. **Fase 1: Configuración Base & Supabase**
   * Inicialización del proyecto Next.js con Tailwind CSS, TypeScript y Lucide Icons.
   * Ejecución del script DDL SQL en el proyecto de Supabase.
   * Creación del bucket `media` en Supabase Storage con políticas de acceso explícitas.
2. **Fase 2: Script de Migración Inicial**
   * Implementación de `scripts/seed.ts` para procesar los ZIPs y Excels de KTsoftware y Etiquétame.
   * Ejecución de la migración y verificación de datos en Supabase Studio.
3. **Fase 3: Shell Móvil, Autenticación y Theming**
   * Pantalla de PIN Gate con validación de servidor y cookie de sesión segura.
   * Header con Workspace Switcher y temas dinámicos (KT vs Etiquétame).
   * Bottom Navigation bar (Hoy/Mañana, Calendario, Audios pendientes).
4. **Fase 4: Tarjetas de Acción y Flujos Móviles**
   * Componente de Carrusel con visor swipeable y paginador.
   * Componente de Reel con video y thumbnail.
   * Botón de copiado con Clipboard API y feedback táctil.
   * Integración de Web Share API con *fallback* de enlaces de descarga/visualización por asset.
   * Edición in-situ de `audio_url` y transición reactiva de estado.
5. **Fase 5: Configuración PWA & Despliegue**
   * Configuración de Web App Manifest (`manifest.json`), iconos e instalación en pantalla de inicio.
   * Service worker y validación en iOS Safari y Android Chrome.
   * Despliegue en Vercel y vinculación de variables de entorno.

---

## 10. Alcance, Fuentes de Verdad y Supuestos

### Incluido en la primera versión

* Un operador, dos espacios de trabajo y contenido del mes importado desde los kits existentes.
* Consulta de publicaciones, filtro por marca, marcado como publicado y edición de enlaces de audio pendientes.
* Copia de copy y acceso manual a los archivos para completar la publicación en las aplicaciones oficiales.
* Instalación como PWA y una experiencia de consulta degradada cuando no haya conexión.

### Fuera de alcance

* Publicación o programación automática en Instagram/TikTok, integración con sus APIs, analítica de campañas o sincronización de estados con Meta Business Suite.
* Roles, invitaciones, colaboración multiusuario y recuperación de cuentas.
* Edición de imágenes/video desde la PWA.

### Precedencia de datos

1. **Planilla del calendario:** fechas, copy, formato y audio cuando esos campos estén presentes.
2. **JSON del kit:** composición, `zona`/`zona_nota` y datos auxiliares de las piezas.
3. **Archivos de salida y ZIP de reels:** multimedia final a publicar.
4. **Documentación del kit:** interpretación de convenciones y límites de cada asset.

La planilla puede incluir datos adicionales que no se muestren en la app. La importación conserva los campos requeridos y reporta los que no pueda mapear; no descarta ni transforma fechas silenciosamente.

## 11. Reglas de Estado y Validación

* `pending_audio`: únicamente un reel al que le falta audio. Al guardar una URL válida, cambiar a `ready` en la misma operación lógica.
* `ready`: contenido preparado y aún no publicado. Es el estado inicial para carruseles, historias y reels con audio definido.
* `published`: el operador confirmó que terminó la publicación. La app no puede verificarlo contra Instagram/TikTok.
* El cambio a `published` requiere confirmación accesible y feedback visible; si falla la persistencia, conservar el estado anterior y comunicar el error.
* Un post atrasado es aquel con `scheduled_date` anterior a hoy y estado distinto de `published`. El filtro y los contadores comparten esta definición.
* Validar enlaces de audio como URL HTTPS y rechazar esquemas `javascript:`, `data:` u otros no esperados. Renderizar copy y notas como texto, nunca como HTML no confiable.
* Ordenar slides por el sufijo numérico del archivo (`_01`, `_02`, ...), no por orden lexicográfico ni por el orden devuelto por Storage.
* Si falta un asset obligatorio, mostrar la publicación con un aviso explícito y no simular que se puede compartir.

## 12. Criterios de Aceptación

La primera versión se considera lista cuando se cumplen todos estos puntos:

1. Una sesión sin autenticar no puede consultar ni modificar publicaciones mediante rutas de servidor.
2. El workspace seleccionado filtra dashboard, calendario, auditoría de audio y contadores de forma consistente.
3. El dashboard distingue hoy, mañana y atrasados con la zona horaria configurada, incluyendo publicaciones `pending_audio` atrasadas.
4. Cada carrusel presenta sus imágenes en orden numérico; reels tienen video y portada diferenciados; historias mantienen su proporción vertical y sus notas de sticker.
5. Copiar el copy completo o cualquier campo de calendario presenta feedback de éxito o un error accionable; los cambios de estado y de audio persisten en Supabase.
6. Compartir prueba capacidad antes de invocar Web Share y muestra una alternativa utilizable cuando no hay soporte.
7. Una importación repetida no duplica posts ni assets; un error parcial queda reflejado en el resumen y en el código de salida.
8. La PWA tiene manifest e iconos válidos, se instala en navegadores compatibles y no presenta una pantalla vacía si la red falla.
9. Los controles principales tienen objetivo táctil de al menos 44 px, foco visible, labels accesibles y estados de carga/error.

## 13. Configuración y Operación

Variables de entorno esperadas (nunca versionar valores reales):

| Variable | Uso |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase; puede exponerse al cliente si se usa el cliente público. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave pública de Supabase; las políticas de acceso siguen siendo obligatorias. |
| `SUPABASE_SERVICE_ROLE_KEY` | Solo para el seed y operaciones de servidor que necesiten privilegios; nunca exponer al cliente. |
| `ACCESS_PIN` | PIN validado por el servidor; nunca usar prefijo `NEXT_PUBLIC_`. |
| `SESSION_SECRET` | Secreto aleatorio para firmar y validar la sesión. |
| `MEDIA_BUCKET` | Nombre del bucket, inicialmente `media`. |
| `APP_TIME_ZONE` | Zona horaria IANA del operador para calcular el día actual y el siguiente. |

Crear `.env.example` con nombres y valores de ejemplo, y excluir los archivos con secretos del control de versiones (excepto el archivo de ejemplo). Documentar si el desarrollo usa Supabase remoto o local.

Antes del despliegue:

* Aplicar el esquema como migración versionada; evitar depender solo de ejecutar SQL manual en el dashboard.
* Configurar RLS y políticas del bucket acordes a la decisión de acceso público/privado.
* Probar login, cierre/expiración de sesión, navegación sin conexión y actualización de una pieza en un entorno de prueba.
* Configurar dominio HTTPS, variables de entorno en Vercel y política de caché coherente con el Service Worker.

## 14. Guía de Implementación y Verificación

* Mantener lectura/escritura detrás de una capa de servidor tipada. Los componentes de UI no deben acoplarse a consultas SQL ni duplicar reglas de estado.
* Separar componentes reutilizables: shell/navigation, selector de workspace, tarjeta de publicación, visor por formato, controles de estado y mensajes de feedback.
* La vista de lista cronológica agrupada por semanas es la opción inicial del calendario móvil; la cuadrícula mensual puede añadirse si no perjudica la navegación táctil.
* La primera carga muestra skeletons; errores de red/servidor ofrecen reintento; las listas vacías explican qué filtro está activo.
* Las pruebas unitarias deben cubrir clasificación/formato, orden de assets, límites de fechas y transiciones de estado. Las pruebas de integración deben cubrir el seed idempotente y las rutas protegidas.
* El `npm test` actual es solo un placeholder; reemplazarlo por un runner y pruebas reales al implementar la aplicación. Ejecutar lint, type-check, pruebas dirigidas y `npm run build` antes de desplegar.
