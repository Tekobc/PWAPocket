import { redirect } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';
import { isSupabaseConfigured } from '@/lib/supabase';
import { Dashboard } from '@/components/dashboard';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  if (!(await isAuthenticated())) redirect('/login');

  if (!isSupabaseConfigured()) {
    return (
      <main className="setup-screen">
        <section className="setup-card">
          <p className="eyebrow">Pocket Manager</p>
          <h1>Falta conectar Supabase</h1>
          <p>
            Configura las variables privadas indicadas en <code>.env.example</code> y reinicia
            el servidor para cargar tus publicaciones.
          </p>
        </section>
      </main>
    );
  }

  return <Dashboard />;
}
