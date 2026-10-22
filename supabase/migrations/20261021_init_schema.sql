-- Migración inicial para Pocket Manager PWA
-- Habilitar extensiones requeridas
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Tabla de Espacios de Trabajo (Workspaces)
CREATE TABLE IF NOT EXISTS workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(50) UNIQUE NOT NULL,      -- 'ktsoftware', 'etiquetame'
    name VARCHAR(100) NOT NULL,            -- 'KTsoftware', 'Etiquétame'
    accent_color VARCHAR(30) NOT NULL,     -- Código HEX o clase Tailwind
    badge_label VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Tipos Enums para Formatos y Estados
DO $$ BEGIN
    CREATE TYPE post_format AS ENUM ('carrusel', 'reel', 'historia');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE post_status AS ENUM ('pending_audio', 'ready', 'published');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. Tabla de Publicaciones (Posts)
CREATE TABLE IF NOT EXISTS posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    code_id VARCHAR(50) NOT NULL,          -- Ej: 'S1-01', 'S1-03', 'S2-05'
    format post_format NOT NULL,
    scheduled_date DATE NOT NULL,
    scheduled_time TIME WITHOUT TIME ZONE,
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

ALTER TABLE posts ADD COLUMN IF NOT EXISTS scheduled_time TIME WITHOUT TIME ZONE;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS source_week INTEGER;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS source_weekday TEXT;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS source_level TEXT;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS series TEXT;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS theme TEXT;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS hook TEXT;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS script TEXT;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS caption_text TEXT;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS hashtags TEXT;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS cta TEXT;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS source_files TEXT;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS source_status TEXT;

-- 4. Tabla de Recursos Multimedia (Post Assets)
CREATE TABLE IF NOT EXISTS post_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    asset_type VARCHAR(20) NOT NULL CHECK (asset_type IN ('image', 'video', 'cover')),
    storage_path TEXT NOT NULL,            -- Ruta en el bucket Supabase Storage
    public_url TEXT,                       -- Compatibilidad; dejar NULL para el bucket privado
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (post_id, asset_type, order_index)
);

-- Índices para optimizar consultas en la PWA móvil
CREATE INDEX IF NOT EXISTS idx_posts_workspace_date ON posts(workspace_id, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_posts_workspace_status_date ON posts(workspace_id, status, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_post_assets_post_order ON post_assets(post_id, order_index ASC);

-- Trigger para updated_at automático
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_posts_updated_at ON posts;
CREATE TRIGGER update_posts_updated_at
    BEFORE UPDATE ON posts
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

-- Trigger para sincronizar published_at según estado
CREATE OR REPLACE FUNCTION handle_post_published_at()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'published' AND (OLD IS NULL OR OLD.status IS DISTINCT FROM 'published' OR NEW.published_at IS NULL) THEN
        NEW.published_at = NOW();
    ELSIF NEW.status <> 'published' THEN
        NEW.published_at = NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_posts_published_at ON posts;
CREATE TRIGGER trg_posts_published_at
    BEFORE INSERT OR UPDATE ON posts
    FOR EACH ROW
    EXECUTE PROCEDURE handle_post_published_at();

-- Configuración de Storage Bucket 'media' y Políticas RLS
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('media', 'media', false, 104857600, ARRAY['image/png', 'image/jpeg', 'video/mp4'])
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Habilitar RLS en tablas
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_assets ENABLE ROW LEVEL SECURITY;

-- La app accede a los datos solo desde el servidor tras validar su cookie de sesión.
-- No se crean políticas para anon/authenticated; service_role opera desde el servidor.
DROP POLICY IF EXISTS "Permitir lectura publica de workspaces" ON workspaces;
DROP POLICY IF EXISTS "Permitir lectura publica de posts" ON posts;
DROP POLICY IF EXISTS "Permitir lectura publica de assets" ON post_assets;
DROP POLICY IF EXISTS "Permitir actualizacion controlada de posts" ON posts;
DROP POLICY IF EXISTS "Permitir insercion de posts" ON posts;
DROP POLICY IF EXISTS "Permitir insercion de assets" ON post_assets;

REVOKE ALL ON TABLE workspaces, posts, post_assets FROM anon, authenticated;
