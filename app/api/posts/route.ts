import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { getSupabaseAdminClient } from '@/lib/supabase';
import { getTodayString, getTomorrowString } from '@/lib/date';
import type { WorkspaceSlug } from '@/lib/types';

const WORKSPACE_SLUGS: WorkspaceSlug[] = ['ktsoftware', 'etiquetame'];

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }
  const slug = request.nextUrl.searchParams.get('workspace');
  if (!slug || !WORKSPACE_SLUGS.includes(slug as WorkspaceSlug)) {
    return NextResponse.json({ error: 'Marca inválida.' }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase no está configurado en el servidor.' }, { status: 503 });
  }

  const { data: workspace, error: workspaceError } = await supabase
    .from('workspaces')
    .select('id, slug, name, accent_color, badge_label')
    .eq('slug', slug)
    .single();
  if (workspaceError) {
    console.error('No se pudo cargar la marca:', workspaceError.message);
    return NextResponse.json({ error: 'No se pudo cargar la marca.' }, { status: 500 });
  }
  if (!workspace) return NextResponse.json({ error: 'La marca aún no está importada.' }, { status: 404 });

  const { data: posts, error } = await supabase
    .from('posts')
    .select('id, workspace_id, code_id, format, scheduled_date, scheduled_time, source_week, source_weekday, source_level, series, theme, hook, script, caption_text, hashtags, cta, source_files, source_status, copy_text, audio_url, status, notes, published_at, assets:post_assets(id, post_id, asset_type, storage_path, public_url, order_index)')
    .eq('workspace_id', workspace.id)
    .order('scheduled_date')
    .order('code_id');
  if (error) {
    console.error('No se pudieron cargar las publicaciones:', error.message);
    return NextResponse.json({ error: 'No se pudieron cargar las publicaciones.' }, { status: 500 });
  }

  return NextResponse.json({
    workspace,
    posts: posts ?? [],
    today: getTodayString(),
    tomorrow: getTomorrowString(),
  }, { headers: { 'Cache-Control': 'private, no-store' } });
}
