import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { getSupabaseAdminClient } from '@/lib/supabase';
import { isValidAudioUrl } from '@/lib/validation';

export const dynamic = 'force-dynamic';

type RouteContext = { params: { id: string } };

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase no está configurado en el servidor.' }, { status: 503 });
  }

  let body: { status?: unknown; audio_url?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 });
  }
  const update: Record<string, string | null> = {};

  if (Object.hasOwn(body, 'audio_url')) {
    if (typeof body.audio_url !== 'string' || !isValidAudioUrl(body.audio_url)) {
      return NextResponse.json({ error: 'Ingresa una URL HTTPS válida para el audio.' }, { status: 400 });
    }
    update.audio_url = body.audio_url.trim();
    update.status = 'ready';
  }
  if (Object.hasOwn(body, 'status')) {
    if (body.status !== 'published' && body.status !== 'ready') {
      return NextResponse.json({ error: 'Estado inválido.' }, { status: 400 });
    }
    update.status = body.status;
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No hay cambios válidos.' }, { status: 400 });
  }

  const { data: current, error: currentError } = await supabase
    .from('posts')
    .select('format, audio_url')
    .eq('id', params.id)
    .maybeSingle();
  if (currentError) {
    console.error('No se pudo validar la publicación:', currentError.message);
    return NextResponse.json({ error: 'No se pudo validar la publicación.' }, { status: 500 });
  }
  if (!current) return NextResponse.json({ error: 'No se encontró la publicación.' }, { status: 404 });
  if (Object.hasOwn(body, 'audio_url') && current.format !== 'reel') {
    return NextResponse.json({ error: 'Solo se puede asociar audio a un reel.' }, { status: 400 });
  }
  const resolvedAudioUrl = update.audio_url ?? current.audio_url;
  if (body.status === 'ready' && current.format === 'reel' && !isValidAudioUrl(resolvedAudioUrl || '')) {
    return NextResponse.json({ error: 'Agrega un enlace HTTPS de audio antes de marcar este reel como listo.' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('posts')
    .update(update)
    .eq('id', params.id)
    .select('id, status, audio_url, published_at')
    .maybeSingle();
  if (error) {
    console.error('No se pudo actualizar la publicación:', error.message);
    return NextResponse.json({ error: 'No se pudo guardar el cambio.' }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: 'No se encontró la publicación.' }, { status: 404 });
  return NextResponse.json({ post: data }, { headers: { 'Cache-Control': 'private, no-store' } });
}
