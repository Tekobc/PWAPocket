export type PostFormat = 'carrusel' | 'reel' | 'historia';
export type PostStatus = 'pending_audio' | 'ready' | 'published';

export type WorkspaceSlug = 'ktsoftware' | 'etiquetame';

export interface Workspace {
  id: string;
  slug: WorkspaceSlug;
  name: string;
  accent_color: string;
  badge_label: string;
  created_at?: string;
}

export type AssetType = 'image' | 'video' | 'cover';

export interface PostAsset {
  id: string;
  post_id: string;
  asset_type: AssetType;
  storage_path: string;
  public_url: string | null;
  order_index: number;
  created_at?: string;
}

export interface Post {
  id: string;
  workspace_id: string;
  code_id: string;
  format: PostFormat;
  scheduled_date: string; // YYYY-MM-DD
  scheduled_time: string | null;
  source_week: number | null;
  source_weekday: string | null;
  source_level: string | null;
  series: string | null;
  theme: string | null;
  hook: string | null;
  script: string | null;
  caption_text: string | null;
  hashtags: string | null;
  cta: string | null;
  source_files: string | null;
  source_status: string | null;
  copy_text: string;
  audio_url: string | null;
  status: PostStatus;
  notes: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  assets?: PostAsset[];
}

export interface WorkspaceSummary {
  workspace: Workspace;
  pendingAudiosCount: number;
  overdueCount: number;
  totalAlertsCount: number; // Audios pendientes + atrasadas no publicadas (sin contar doble)
}

export type CalendarFilter = 'all' | 'pending' | 'published';
