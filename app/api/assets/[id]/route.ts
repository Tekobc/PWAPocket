import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { getSupabaseAdminClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

type RouteContext = { params: { id: string } };

export async function GET(request: NextRequest, { params }: RouteContext) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase no está configurado en el servidor.' }, { status: 503 });
  }

  const { data: asset, error: assetError } = await supabase
    .from('post_assets')
    .select('storage_path, asset_type')
    .eq('id', params.id)
    .maybeSingle();
  if (assetError) {
    console.error('No se pudo consultar el recurso multimedia:', assetError.message);
    return NextResponse.json({ error: 'No se pudo abrir el recurso.' }, { status: 500 });
  }
  if (!asset) return NextResponse.json({ error: 'No se encontró el recurso.' }, { status: 404 });

  const bucket = process.env.MEDIA_BUCKET || 'media';
  const { data: signed, error: signedError } = await supabase.storage
    .from(bucket)
    .createSignedUrl(asset.storage_path, 300);
  if (signedError || !signed?.signedUrl) {
    console.error('No se pudo crear el enlace privado del recurso:', signedError?.message);
    return NextResponse.json({ error: 'No se pudo abrir el recurso.' }, { status: 502 });
  }

  const headers: HeadersInit = {};
  const range = request.headers.get('range');
  if (range) headers.Range = range;
  const upstream = await fetch(signed.signedUrl, { headers, cache: 'no-store' });
  if (!upstream.ok && upstream.status !== 206) {
    console.error('Storage no pudo servir el recurso:', upstream.status);
    return NextResponse.json({ error: 'No se pudo descargar el recurso.' }, { status: 502 });
  }

  const responseHeaders = new Headers({
    'Cache-Control': 'private, no-store',
    'Content-Type': upstream.headers.get('content-type') || 'application/octet-stream',
    'X-Content-Type-Options': 'nosniff',
  });
  for (const name of ['content-length', 'content-range', 'accept-ranges']) {
    const value = upstream.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }
  const downloadName = asset.storage_path.split('/').pop()?.replace(/["\\]/g, '') || 'media';
  if (request.nextUrl.searchParams.get('download') === '1') {
    responseHeaders.set('Content-Disposition', `attachment; filename="${downloadName}"`);
  }
  return new NextResponse(upstream.body, { status: upstream.status, headers: responseHeaders });
}
