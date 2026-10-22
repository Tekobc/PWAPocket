'use client';

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clipboard,
  Download,
  ExternalLink,
  Headphones,
  LoaderCircle,
  LogOut,
  Share2,
  Smartphone,
} from 'lucide-react';
import type { Post, Workspace, WorkspaceSlug } from '@/lib/types';
import { formatFriendlyDate, formatShortDate, isOverdue } from '@/lib/date';
import { isValidAudioUrl } from '@/lib/validation';

type Page = 'today' | 'calendar' | 'audio';
type Filter = 'all' | 'pending' | 'published';
type PostResponse = { workspace: Workspace; posts: Post[]; today: string; tomorrow: string };

const DEFAULT_WORKSPACES: Workspace[] = [
  { id: 'ktsoftware', slug: 'ktsoftware', name: 'KTsoftware', accent_color: '#3b82f6', badge_label: 'KT B2B Tech' },
  { id: 'etiquetame', slug: 'etiquetame', name: 'Etiquétame', accent_color: '#facc15', badge_label: 'Etiquétame B2C' },
];

const pageLabels: Record<Page, string> = { today: 'Hoy y mañana', calendar: 'Calendario', audio: 'Audios' };

export function Dashboard() {
  const [page, setPage] = useState<Page>('today');
  const [filter, setFilter] = useState<Filter>('all');
  const [slug, setSlug] = useState<WorkspaceSlug>('ktsoftware');
  const [workspaces, setWorkspaces] = useState<Workspace[]>(DEFAULT_WORKSPACES);
  const [data, setData] = useState<PostResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyPost, setBusyPost] = useState<string | null>(null);
  const [audioInputs, setAudioInputs] = useState<Record<string, string>>({});
  const [carouselPages, setCarouselPages] = useState<Record<string, number>>({});

  const loadPosts = useCallback(async (workspace: WorkspaceSlug) => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/posts?workspace=${workspace}`, { cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'No se pudieron cargar las publicaciones.');
      setData(result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo conectar con el servidor.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPosts(slug);
  }, [loadPosts, slug]);

  useEffect(() => {
    let active = true;
    fetch('/api/workspaces', { cache: 'no-store' })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'No se pudieron cargar las marcas.');
        if (active && result.workspaces?.length) setWorkspaces(result.workspaces);
      })
      .catch((cause: unknown) => {
        if (active) setNotice(cause instanceof Error ? cause.message : 'No se pudieron cargar las marcas.');
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    void navigator.serviceWorker.register('/sw.js').catch((cause: unknown) => {
      console.error('No se pudo registrar el modo sin conexión:', cause);
    });
  }, []);

  const posts = data?.posts ?? [];
  const today = data?.today ?? '';
  const tomorrow = data?.tomorrow ?? '';
  const overdue = useMemo(() => posts.filter((post) => isOverdue(post.scheduled_date, today) && post.status !== 'published'), [posts, today]);
  const pendingAudio = posts.filter((post) => post.status === 'pending_audio');
  const alertCount = posts.filter((post) =>
    (post.status === 'pending_audio' || (isOverdue(post.scheduled_date, today) && post.status !== 'published')),
  ).length;
  const selectedWorkspace = workspaces.find((workspace) => workspace.slug === slug);

  async function updatePost(post: Post, changes: { status?: 'published' | 'ready'; audio_url?: string }) {
    setBusyPost(post.id);
    setNotice('');
    try {
      const response = await fetch(`/api/posts/${post.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changes),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'No se pudo guardar.');
      setNotice(changes.audio_url ? 'Enlace de audio guardado.' : (changes.status === 'published' ? 'Publicación marcada como publicada.' : 'Estado actualizado.'));
      await loadPosts(slug);
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : 'No se pudo guardar el cambio.');
    } finally {
      setBusyPost(null);
    }
  }

  async function copyText(post: Post) {
    await copyValue(post.copy_text, `Copy de ${post.code_id}`);
  }

  async function copyValue(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setNotice(`${label} copiado.`);
    } catch {
      setNotice('No se pudo copiar. Revisa los permisos del navegador.');
    }
  }

  async function shareAssets(post: Post) {
    const assets = orderedAssets(post);
    if (!assets.length) {
      setNotice('Esta publicación no tiene archivos multimedia cargados.');
      return;
    }
    try {
      const files: File[] = await Promise.all(assets.map(async (asset, index) => {
        const response = await fetch(`/api/assets/${asset.id}`, { cache: 'no-store' });
        if (!response.ok) throw new Error('No se pudo preparar uno de los archivos.');
        const blob = await response.blob();
        const ext = blob.type === 'video/mp4' ? 'mp4' : 'png';
        const name = post.format === 'carrusel' ? `${post.code_id}_${String(index + 1).padStart(2, '0')}.${ext}` : `${post.code_id}.${ext}`;
        return new File([blob], name, { type: blob.type || (ext === 'mp4' ? 'video/mp4' : 'image/png') });
      }));
      if (navigator.share && (!navigator.canShare || navigator.canShare({ files }))) {
        await navigator.share({ files, title: `${post.code_id} · ${post.format}` });
        setNotice('Se abrió el menú para compartir.');
      } else {
        setNotice('Tu navegador no admite compartir estos archivos. Usa los enlaces de descarga.');
      }
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') return;
      setNotice(cause instanceof Error ? cause.message : 'No se pudieron compartir los archivos.');
    }
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.assign('/login');
  }

  let visiblePosts = posts;
  if (page === 'today') visiblePosts = posts.filter((post) => post.scheduled_date === today || post.scheduled_date === tomorrow);
  if (page === 'audio') visiblePosts = pendingAudio;
  if (page === 'calendar') {
    if (filter === 'pending') visiblePosts = posts.filter((post) => post.status !== 'published');
    if (filter === 'published') visiblePosts = posts.filter((post) => post.status === 'published');
  }

  return (
    <main className="app-shell" style={{ '--brand-accent': selectedWorkspace?.accent_color || '#3b82f6' } as CSSProperties}>
      <header className="topbar">
        <div className="topbar-title">
          <span className="brand-dot" />
          <div><strong>Pocket Manager</strong><small>{selectedWorkspace?.badge_label || 'Publicaciones'}</small></div>
        </div>
        <button className="icon-button" type="button" aria-label="Cerrar sesión" onClick={logout}><LogOut size={19} /></button>
      </header>

      <section className="workspace-switch" aria-label="Seleccionar marca">
        {workspaces.map((workspace) => (
          <button key={workspace.slug} type="button" className={slug === workspace.slug ? 'workspace-option active' : 'workspace-option'} onClick={() => setSlug(workspace.slug as WorkspaceSlug)}>
            {workspace.name}
          </button>
        ))}
      </section>

      <section className="page-heading">
        <div><p className="eyebrow">Panel de publicaciones</p><h1>{pageLabels[page]}</h1></div>
        <div className="heading-date">{alertCount > 0 && <span className="alert-badge"><CircleAlert size={14} /> {alertCount}</span>}</div>
      </section>

      {notice && <div className="notice" role="status">{notice}<button onClick={() => setNotice('')} aria-label="Cerrar">×</button></div>}
      {error && <div className="error-banner" role="alert"><span>{error}</span><button className="secondary-button" onClick={() => void loadPosts(slug)}>Reintentar</button></div>}

      {!error && overdue.length > 0 && page === 'today' && (
        <details className="overdue-banner">
          <summary><CircleAlert size={17} /> Tienes {overdue.length} publicaciones pasadas sin marcar</summary>
          <p>{overdue.map((post) => `${post.code_id} · ${formatShortDate(post.scheduled_date)}`).join('  ·  ')}</p>
        </details>
      )}

      {page === 'calendar' && (
        <div className="filter-row" aria-label="Filtrar publicaciones">
          {(['all', 'pending', 'published'] as Filter[]).map((item) => (
            <button key={item} className={filter === item ? 'filter-chip selected' : 'filter-chip'} onClick={() => setFilter(item)}>
              {item === 'all' ? 'Todas' : item === 'pending' ? 'Pendientes' : 'Publicadas'}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="loading-state"><LoaderCircle className="spin" size={24} /> Cargando publicaciones…</div>
      ) : visiblePosts.length === 0 ? (
        <div className="empty-state">
          <Smartphone size={27} />
          <h2>{page === 'audio' ? 'No hay audios pendientes' : page === 'today' ? 'No hay publicaciones para estos días' : 'No hay publicaciones en este filtro'}</h2>
          <p>{page === 'today' ? 'Cuando haya contenido programado para hoy o mañana, aparecerá aquí.' : 'Prueba con otro filtro o revisa la otra marca.'}</p>
        </div>
      ) : (
        <section className="post-list" aria-label={pageLabels[page]}>
          {page === 'today' ? visiblePosts.map((post, index) => (
            <div className="day-group" key={post.id}>
              {(index === 0 || visiblePosts[index - 1].scheduled_date !== post.scheduled_date) && (
                <h2 className="list-section-title">{post.scheduled_date === today ? 'Hoy' : 'Mañana'} · {formatFriendlyDate(post.scheduled_date)}</h2>
              )}
              <PostCard
                post={post}
                busy={busyPost === post.id}
                audioValue={audioInputs[post.id] ?? ''}
                carouselPage={carouselPages[post.id] ?? 0}
                page={page}
                today={today}
                onAudioChange={(value) => setAudioInputs((old) => ({ ...old, [post.id]: value }))}
                onCarouselPage={(value) => setCarouselPages((old) => ({ ...old, [post.id]: value }))}
                onCopy={() => void copyText(post)}
                onCopyValue={(value, label) => void copyValue(value, label)}
                onShare={() => void shareAssets(post)}
                onStatus={(status) => void updatePost(post, { status })}
                onSaveAudio={() => void updatePost(post, { audio_url: audioInputs[post.id] || '' })}
              />
            </div>
          )) : visiblePosts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              busy={busyPost === post.id}
              audioValue={audioInputs[post.id] ?? ''}
              carouselPage={carouselPages[post.id] ?? 0}
              page={page}
              today={today}
              onAudioChange={(value) => setAudioInputs((old) => ({ ...old, [post.id]: value }))}
              onCarouselPage={(value) => setCarouselPages((old) => ({ ...old, [post.id]: value }))}
              onCopy={() => void copyText(post)}
              onCopyValue={(value, label) => void copyValue(value, label)}
              onShare={() => void shareAssets(post)}
              onStatus={(status) => void updatePost(post, { status })}
              onSaveAudio={() => void updatePost(post, { audio_url: audioInputs[post.id] || '' })}
            />
          ))}
        </section>
      )}

      <nav className="bottom-nav" aria-label="Navegación principal">
        <button className={page === 'today' ? 'nav-item active' : 'nav-item'} onClick={() => setPage('today')}><Smartphone size={20} /><span>Hoy</span></button>
        <button className={page === 'calendar' ? 'nav-item active' : 'nav-item'} onClick={() => setPage('calendar')}><CalendarDays size={20} /><span>Calendario</span></button>
        <button className={page === 'audio' ? 'nav-item active' : 'nav-item'} onClick={() => setPage('audio')}><Headphones size={20} /><span>Audios{pendingAudio.length > 0 && <i>{pendingAudio.length}</i>}</span></button>
      </nav>
    </main>
  );
}

function orderedAssets(post: Post) {
  return [...(post.assets ?? [])].sort((left, right) => left.order_index - right.order_index);
}

function PostCard({
  post, busy, audioValue, carouselPage, page, today, onAudioChange, onCarouselPage, onCopy, onCopyValue, onShare, onStatus, onSaveAudio,
}: {
  post: Post; busy: boolean; audioValue: string; carouselPage: number; page: Page; today: string;
  onAudioChange: (value: string) => void; onCarouselPage: (value: number) => void;
  onCopy: () => void; onCopyValue: (value: string, label: string) => void; onShare: () => void;
  onStatus: (status: 'published' | 'ready') => void; onSaveAudio: () => void;
}) {
  const assets = orderedAssets(post);
  const imageAssets = post.format === 'carrusel' ? assets.filter((asset) => asset.asset_type === 'image') : [];
  const displayedCarouselPage = Math.min(carouselPage, Math.max(0, imageAssets.length - 1));
  const video = assets.find((asset) => asset.asset_type === 'video');
  const cover = assets.find((asset) => asset.asset_type === 'cover');
  const image = post.format === 'historia' ? assets.find((asset) => asset.asset_type === 'image') : undefined;
  const missingAssets = (post.format === 'carrusel' && imageAssets.length === 0)
    || (post.format === 'reel' && (!video || !cover))
    || (post.format === 'historia' && !image);
  const expired = isOverdue(post.scheduled_date, today) && post.status !== 'published';
  const fields = [
    ['Código', post.code_id],
    ['Semana', post.source_week === null ? null : String(post.source_week)],
    ['Día', post.source_weekday],
    ['Fecha', post.scheduled_date],
    ['Hora', post.scheduled_time?.slice(0, 5) ?? null],
    ['Formato', post.format],
    ['Nivel', post.source_level],
    ['Serie / pilar', post.series],
    ['Tema', post.theme],
    ['Gancho (primeros 2 s)', post.hook],
    ['Guion / contenido', post.script],
    ['Caption / texto en pantalla', post.caption_text || post.copy_text],
    ['Hashtags', post.hashtags],
    ['CTA', post.cta],
    ['Link de audio', post.audio_url],
    ['Archivos en planilla', post.source_files],
    ['Estado en planilla', post.source_status],
    ['Notas', post.notes],
  ].filter((field): field is [string, string] => Boolean(field[1]?.trim()));

  return (
    <article className="post-card">
      <div className="post-card-top">
        <div><span className={`format-badge ${post.format}`}>{post.format}</span><span className="post-code">{post.code_id}</span></div>
        <span className="post-date">{formatFriendlyDate(post.scheduled_date)}{post.scheduled_time ? ` · ${post.scheduled_time.slice(0, 5)}` : ''}</span>
      </div>

      {post.format === 'carrusel' && imageAssets.length > 0 && (
        <div className="carousel-viewer">
          <img src={`/api/assets/${imageAssets[displayedCarouselPage].id}`} alt={`Slide ${displayedCarouselPage + 1} de ${post.code_id}`} />
          <div className="carousel-controls">
            <button aria-label="Slide anterior" disabled={displayedCarouselPage === 0} onClick={() => onCarouselPage(displayedCarouselPage - 1)}><ChevronLeft size={20} /></button>
            <span>{displayedCarouselPage + 1} / {imageAssets.length}</span>
            <button aria-label="Slide siguiente" disabled={displayedCarouselPage >= imageAssets.length - 1} onClick={() => onCarouselPage(displayedCarouselPage + 1)}><ChevronRight size={20} /></button>
          </div>
        </div>
      )}
      {post.format === 'reel' && video && (
        <div className="reel-viewer">
          <video src={`/api/assets/${video.id}`} poster={cover ? `/api/assets/${cover.id}` : undefined} controls playsInline preload="metadata" />
          {cover && <a className="cover-link" href={`/api/assets/${cover.id}`} target="_blank" rel="noreferrer">Ver portada <ExternalLink size={14} /></a>}
        </div>
      )}
      {post.format === 'historia' && image && <div className="story-viewer"><img src={`/api/assets/${image.id}`} alt={`Historia ${post.code_id}`} /></div>}

      {missingAssets && <p className="missing-assets" role="status"><CircleAlert size={16} /> Faltan archivos multimedia obligatorios para esta publicación.</p>}
      {post.format === 'historia' && post.notes && <p className="post-notes">Nota para publicar: {post.notes}</p>}
      {post.copy_text && <p className="copy-preview">{post.copy_text}</p>}
      <details className="spreadsheet-fields">
        <summary>Campos del Excel · {fields.length}</summary>
        <div className="spreadsheet-fields-list">
          {fields.map(([label, value]) => (
            <div className="spreadsheet-field" key={label}>
              <div><strong>{label}</strong><p>{value}</p></div>
              <button className="field-copy-button" type="button" onClick={() => onCopyValue(value, label)}><Clipboard size={15} /> Copiar</button>
            </div>
          ))}
        </div>
      </details>

      <div className="post-actions">
        <button className="primary-button" onClick={onCopy} disabled={!post.copy_text}><Clipboard size={17} /> Copiar copy</button>
        <button className="secondary-button" onClick={onShare} disabled={!assets.length}><Share2 size={17} /> Compartir</button>
      </div>
      {assets.length > 0 && (
        <details className="download-list">
          <summary><Download size={16} /> Descargar o abrir archivo</summary>
          {assets.map((asset, index) => (
            <a key={asset.id} href={`/api/assets/${asset.id}?download=1`}>
              {asset.asset_type === 'cover' ? 'Portada' : asset.asset_type === 'video' ? 'Video' : post.format === 'carrusel' ? `Slide ${index + 1}` : 'Imagen'}
            </a>
          ))}
        </details>
      )}

      {post.audio_url && isValidAudioUrl(post.audio_url) && (
        <a className="audio-link" href={post.audio_url} target="_blank" rel="noopener noreferrer"><Headphones size={17} /> Abrir audio <ExternalLink size={14} /></a>
      )}
      {post.status === 'pending_audio' && (
        <div className="audio-entry">
          <label htmlFor={`audio-${post.id}`}>Pegar link de audio HTTPS</label>
          <div><input id={`audio-${post.id}`} type="url" inputMode="url" placeholder="https://…" value={audioValue} onChange={(event) => onAudioChange(event.target.value)} /><button className="secondary-button" disabled={busy || !isValidAudioUrl(audioValue)} onClick={onSaveAudio}>{busy ? 'Guardando…' : 'Guardar'}</button></div>
        </div>
      )}
      {post.status === 'published' ? (
        <div className="published-state"><Check size={17} /> Publicada</div>
      ) : (
        <button className={`publish-button${expired ? ' overdue' : ''}`} disabled={busy} onClick={() => {
          if (window.confirm(`¿Confirmas que publicaste ${post.code_id}?`)) onStatus('published');
        }}>
          {busy ? 'Guardando…' : expired ? 'Marcar atrasada como publicada' : 'Marcar como publicada'}
        </button>
      )}
      {page === 'calendar' && post.status === 'published' && (
        <button className="text-button" disabled={busy} onClick={() => onStatus('ready')}>Deshacer publicación</button>
      )}
    </article>
  );
}
