import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { getSupabaseAdminClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase no está configurado en el servidor.' }, { status: 503 });
  }

  const { data, error } = await supabase
    .from('workspaces')
    .select('id, slug, name, accent_color, badge_label')
    .order('name');
  if (error) {
    console.error('No se pudieron cargar los espacios de trabajo:', error.message);
    return NextResponse.json({ error: 'No se pudieron cargar las marcas.' }, { status: 500 });
  }
  return NextResponse.json({ workspaces: data });
}
