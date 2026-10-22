export const dynamic = 'force-static';

export default function OfflinePage() {
  return (
    <main className="setup-screen">
      <section className="setup-card">
        <p className="eyebrow">Pocket Manager</p>
        <h1>Sin conexión</h1>
        <p>Conéctate a internet y vuelve a abrir la app. Tus datos privados no se guardan offline.</p>
      </section>
    </main>
  );
}
