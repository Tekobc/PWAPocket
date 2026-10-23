import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import * as XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Load .env or .env.local
dotenv.config({ path: path.resolve(rootDir, '.env.local') });
dotenv.config({ path: path.resolve(rootDir, '.env') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const MEDIA_BUCKET = process.env.MEDIA_BUCKET || 'media';

const SOURCES = {
  ktInstagram: path.resolve(rootDir, 'KT_Instagram_Plantillas.zip'),
  ktReels: path.resolve(rootDir, 'KT_Reels_Mes1_MP4.zip'),
  ktAudio: path.resolve(rootDir, 'audios.zip'),
  etqInstagram: path.resolve(rootDir, 'etiquetame_Instagram_Kit.zip'),
  etqReels: path.resolve(rootDir, 'etiquetame_Reels_Mes1.zip'),
};

const BRANDS = [
  {
    slug: 'ktsoftware',
    name: 'KTsoftware',
    accent_color: '#0066FF',
    badge_label: 'KT B2B Tech',
    instagramZip: SOURCES.ktInstagram,
    reelsZip: SOURCES.ktReels,
    excelInnerPath: 'kt-instagram/Calendario_Mes1_KTSoftware.xlsx',
  },
  {
    slug: 'etiquetame',
    name: 'Etiquétame',
    accent_color: '#FFD166',
    badge_label: 'Etiquétame B2C',
    instagramZip: SOURCES.etqInstagram,
    reelsZip: SOURCES.etqReels,
    excelInnerPath: 'etq-kit/Calendario_Mes1_etiquetame.xlsx',
  },
];

const xlsx = XLSX.default || XLSX;

function parseExcelDate(val) {
  if (typeof val === 'number') {
    if (xlsx.SSF && xlsx.SSF.parse_date_code) {
      const parsed = xlsx.SSF.parse_date_code(val);
      if (parsed) {
        const y = parsed.y;
        const m = String(parsed.m).padStart(2, '0');
        const d = String(parsed.d).padStart(2, '0');
        return `${y}-${m}-${d}`;
      }
    }
    // Fallback: standard Excel serial to date conversion
    const utcDays = Math.floor(val - 25569);
    const date = new Date(utcDays * 86400 * 1000);
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  if (val instanceof Date) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  if (typeof val === 'string') {
    const match = val.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return match[0];
  }
  throw new Error(`No se pudo interpretar la fecha del calendario: ${val}`);
}

function parseExcelTime(val) {
  if (typeof val === 'number') {
    const totalMinutes = Math.round((val % 1) * 24 * 60);
    return `${String(Math.floor(totalMinutes / 60) % 24).padStart(2, '0')}:${String(totalMinutes % 60).padStart(2, '0')}`;
  }
  if (val instanceof Date) {
    return `${String(val.getHours()).padStart(2, '0')}:${String(val.getMinutes()).padStart(2, '0')}`;
  }
  if (typeof val === 'string') {
    const match = val.trim().match(/^(\d{1,2}):(\d{2})/);
    if (match && Number(match[1]) < 24 && Number(match[2]) < 60) {
      return `${match[1].padStart(2, '0')}:${match[2]}`;
    }
  }
  return null;
}

function normalizeFormat(formatStr) {
  const norm = (formatStr || '').trim().toLowerCase();
  if (norm.includes('carrusel')) return 'carrusel';
  if (norm.includes('reel')) return 'reel';
  if (norm.includes('historia')) return 'historia';
  throw new Error(`Formato desconocido en calendario: ${formatStr}`);
}

async function runSeed() {
  console.log('=== Iniciando Ingesta y Migración Inicial: Pocket Manager ===\n');
  const dryRun = process.argv.includes('--dry-run');

  // 1. Validar que los 4 archivos ZIP existan
  for (const [key, filePath] of Object.entries(SOURCES)) {
    if (!fs.existsSync(filePath)) {
      console.error(`[ERROR CRÍTICO] Falta el archivo requerido: ${filePath} (${key})`);
      process.exit(1);
    }
    console.log(`[OK] Archivo verificado: ${path.basename(filePath)}`);
  }

  const hasSupabase = Boolean(SUPABASE_URL && SUPABASE_KEY);
  if (!hasSupabase && !dryRun) {
    throw new Error('Configura NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env.local o ejecuta npm run seed:check.');
  }
  if (dryRun) {
    console.log('[AVISO] Modo de validación: no se escribirán datos ni archivos en Supabase.\n');
  }

  const supabase = hasSupabase ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;
  const audioArchive = new AdmZip(SOURCES.ktAudio);
  const audioPackageEntry = audioArchive.getEntries().find(e => path.basename(e.entryName) === 'KT_Voz_y_Audios.zip');
  if (!audioPackageEntry) {
    throw new Error('No se encontró KT_Voz_y_Audios.zip dentro de audios.zip.');
  }
  const voiceAudioZip = new AdmZip(audioPackageEntry.getData());

  let totalPostsInsertedOrUpdated = 0;
  let totalAssetsUploaded = 0;
  let errorsEncountered = 0;

  for (const brand of BRANDS) {
    console.log(`\n========================================`);
    console.log(`Procesando Espacio de Trabajo: ${brand.name} (${brand.slug})`);
    console.log(`========================================`);

    const igZip = new AdmZip(brand.instagramZip);
    const reelsZip = new AdmZip(brand.reelsZip);

    // Leer el Excel dentro del ZIP de Instagram
    const excelEntry = igZip.getEntry(brand.excelInnerPath);
    if (!excelEntry) {
      console.error(`[ERROR] No se encontró el Excel '${brand.excelInnerPath}' dentro de ${path.basename(brand.instagramZip)}`);
      errorsEncountered++;
      continue;
    }

    const excelBuffer = excelEntry.getData();
    const readFn = xlsx.read || XLSX.read;
    const utilsObj = xlsx.utils || XLSX.utils;
    const workbook = readFn(excelBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames.find(s => s.toLowerCase().includes('calendario')) || workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rawRows = utilsObj.sheet_to_json(worksheet, { header: 1 });

    // Localizar fila de encabezados
    let headerRowIndex = rawRows.findIndex(row => Array.isArray(row) && row.includes('ID') && row.includes('Formato'));
    if (headerRowIndex === -1) {
      console.error(`[ERROR] No se encontró la cabecera esperada con 'ID' y 'Formato' en ${sheetName}`);
      errorsEncountered++;
      continue;
    }

    const headers = rawRows[headerRowIndex].map((h) => String(h || '').trim());
    const idIdx = headers.indexOf('ID');
    const fechaIdx = headers.indexOf('Fecha');
    const semanaIdx = headers.indexOf('Semana');
    const weekdayIdx = headers.indexOf('Día');
    const timeIdx = headers.indexOf('Hora');
    const formatoIdx = headers.indexOf('Formato');
    const levelIdx = headers.indexOf('Nivel');
    const seriesIdx = headers.findIndex(h => h.toLowerCase().includes('serie'));
    const themeIdx = headers.indexOf('Tema');
    const hookIdx = headers.findIndex(h => h.toLowerCase().includes('gancho'));
    const captionIdx = headers.findIndex(h => h.toLowerCase().includes('caption'));
    const hashtagsIdx = headers.indexOf('Hashtags');
    const guionIdx = headers.findIndex(h => h.toLowerCase().includes('guion'));
    const ctaIdx = headers.indexOf('CTA');
    const filesIdx = headers.indexOf('Archivos');
    const sourceStatusIdx = headers.indexOf('Estado');
    const audioIdx = headers.findIndex(h => h.toLowerCase().includes('audio'));
    const notasIdx = headers.indexOf('Notas');

    // Cargar JSONs de historias para zonas de stickers
    const historiasJsonEntry = igZip.getEntries().find(e => e.entryName.endsWith('HISTORIAS-MES1.json'));
    let historiasMap = new Map();
    if (historiasJsonEntry) {
      try {
        const histData = JSON.parse(historiasJsonEntry.getData().toString('utf8'));
        if (Array.isArray(histData.slides)) {
          for (const s of histData.slides) {
            if (s.archivo) historiasMap.set(s.archivo, s);
          }
        }
      } catch (err) {
        console.warn(`[AVISO] No se pudo parsear HISTORIAS-MES1.json para ${brand.slug}:`, err);
      }
    }

    const parsedPosts = [];

    for (let r = headerRowIndex + 1; r < rawRows.length; r++) {
      const row = rawRows[r];
      if (!row || !row[idIdx]) continue;

      const code_id = String(row[idIdx]).trim();
      if (!code_id.match(/^S\d-\d{2}$/)) continue;

      const rawFormat = row[formatoIdx];
      const format = normalizeFormat(rawFormat);
      const scheduled_date = parseExcelDate(row[fechaIdx]);
      const scheduled_time = timeIdx === -1 ? null : parseExcelTime(row[timeIdx]);

      // Copy text: Caption + Hashtags
      const captionText = (captionIdx !== -1 && row[captionIdx]) ? String(row[captionIdx]).trim() : '';
      const hashtagsText = (hashtagsIdx !== -1 && row[hashtagsIdx]) ? String(row[hashtagsIdx]).trim() : '';
      const sourceWeek = semanaIdx !== -1 && row[semanaIdx] !== undefined ? Number(row[semanaIdx]) : null;
      let copy_text = captionText;
      if (hashtagsText && (format === 'carrusel' || format === 'reel')) {
        copy_text = copy_text ? `${copy_text}\n\n${hashtagsText}` : hashtagsText;
      }

      // Audio URL
      let audio_url = null;
      if (audioIdx !== -1 && row[audioIdx]) {
        const rawAudio = String(row[audioIdx]).trim();
        if (rawAudio.startsWith('https://')) {
          audio_url = rawAudio;
        }
      }

      // Status rule
      let status = 'ready';
      const voiceAudioEntry = brand.slug === 'ktsoftware' && format === 'reel'
        ? voiceAudioZip.getEntries().find(e => path.basename(e.entryName) === `${code_id}_voz.mp3`)
        : undefined;
      if (format === 'reel') {
        status = audio_url || voiceAudioEntry ? 'ready' : 'pending_audio';
      }

      // Notes & Stickers
      let notesParts = [];
      const rowNota = (notasIdx !== -1 && row[notasIdx]) ? String(row[notasIdx]).trim() : '';
      if (rowNota) notesParts.push(`Nota: ${rowNota}`);

      const rowGuion = (guionIdx !== -1 && row[guionIdx]) ? String(row[guionIdx]).trim() : '';
      if (rowGuion && format === 'historia') {
        notesParts.push(`Guion: ${rowGuion}`);
      }

      const ctaVal = (ctaIdx !== -1 && row[ctaIdx]) ? String(row[ctaIdx]).trim() : '';
      if (ctaVal) notesParts.push(`CTA: ${ctaVal}`);

      if (format === 'historia' && historiasMap.has(code_id)) {
        const hInfo = historiasMap.get(code_id);
        if (hInfo.zona_nota || hInfo.zona) {
          notesParts.push(`Zona Sticker: ${hInfo.zona_nota || ''} (${hInfo.zona || 0}px)`);
        }
      }

      const notes = notesParts.length > 0 ? notesParts.join(' | ') : null;

      // Assets
      const assets = [];

      if (format === 'carrusel') {
        // Buscar slides en salida/<code_id>/<code_id>_XX.png
        const slideEntries = igZip.getEntries().filter(e => {
          const name = e.entryName;
          return name.includes(`salida/${code_id}/`) && name.endsWith('.png');
        });

        // Ordenar por sufijo numérico
        slideEntries.sort((a, b) => {
          const matchA = a.entryName.match(/_(\d+)\.png$/);
          const matchB = b.entryName.match(/_(\d+)\.png$/);
          const numA = matchA ? parseInt(matchA[1], 10) : 0;
          const numB = matchB ? parseInt(matchB[1], 10) : 0;
          return numA - numB;
        });

        if (slideEntries.length === 0) {
          console.error(`[ERROR] No se encontraron slides de carrusel para ${brand.slug} ${code_id}`);
          errorsEncountered++;
        }

        slideEntries.forEach((entry, idx) => {
          const baseName = path.basename(entry.entryName);
          assets.push({
            asset_type: 'image',
            storage_path: `${brand.slug}/carruseles/${code_id}/${baseName}`,
            order_index: idx,
            buffer: entry.getData(),
            contentType: 'image/png',
          });
        });
      } else if (format === 'reel') {
        // Video MP4 en reelsZip
        const videoEntry = reelsZip.getEntries().find(e => path.basename(e.entryName) === `${code_id}.mp4`);
        if (!videoEntry) {
          console.error(`[ERROR] No se encontró video ${code_id}.mp4 para ${brand.slug}`);
          errorsEncountered++;
        } else {
          assets.push({
            asset_type: 'video',
            storage_path: `${brand.slug}/reels/${code_id}.mp4`,
            order_index: 0,
            buffer: videoEntry.getData(),
            contentType: 'video/mp4',
          });
        }

        // Portada / thumbnail en salida/REELS-MES1/<code_id>.png
        const coverEntry = igZip.getEntries().find(e => {
          return e.entryName.includes('REELS-MES1') && path.basename(e.entryName) === `${code_id}.png`;
        });
        if (!coverEntry) {
          console.error(`[ERROR] No se encontró portada ${code_id}.png para reel de ${brand.slug}`);
          errorsEncountered++;
        } else {
          assets.push({
            asset_type: 'cover',
            storage_path: `${brand.slug}/covers/${code_id}.png`,
            order_index: 0,
            buffer: coverEntry.getData(),
            contentType: 'image/png',
          });
        }

        if (voiceAudioEntry) {
          assets.push({
            asset_type: 'audio',
            storage_path: `${brand.slug}/audios/${code_id}_voz.mp3`,
            order_index: 0,
            buffer: voiceAudioEntry.getData(),
            contentType: 'audio/mpeg',
          });
        }
      } else if (format === 'historia') {
        // Imagen 9:16 en salida/HISTORIAS-MES1/<code_id>.png
        const storyEntry = igZip.getEntries().find(e => {
          return e.entryName.includes('HISTORIAS-MES1') && path.basename(e.entryName) === `${code_id}.png`;
        });
        if (!storyEntry) {
          console.error(`[ERROR] No se encontró imagen de historia para ${code_id}.png en ${brand.slug}`);
          errorsEncountered++;
        } else {
          assets.push({
            asset_type: 'image',
            storage_path: `${brand.slug}/historias/${code_id}.png`,
            order_index: 0,
            buffer: storyEntry.getData(),
            contentType: 'image/png',
          });
        }
      }

      parsedPosts.push({
        code_id,
        format,
        scheduled_date,
        scheduled_time,
        source_week: Number.isFinite(sourceWeek) ? sourceWeek : null,
        source_weekday: weekdayIdx !== -1 && row[weekdayIdx] ? String(row[weekdayIdx]).trim() : null,
        source_level: levelIdx !== -1 && row[levelIdx] !== undefined ? String(row[levelIdx]).trim() : null,
        series: seriesIdx !== -1 && row[seriesIdx] ? String(row[seriesIdx]).trim() : null,
        theme: themeIdx !== -1 && row[themeIdx] ? String(row[themeIdx]).trim() : null,
        hook: hookIdx !== -1 && row[hookIdx] ? String(row[hookIdx]).trim() : null,
        script: rowGuion || null,
        caption_text: captionText || null,
        hashtags: hashtagsText || null,
        cta: ctaVal || null,
        source_files: filesIdx !== -1 && row[filesIdx] ? String(row[filesIdx]).trim() : null,
        source_status: sourceStatusIdx !== -1 && row[sourceStatusIdx] ? String(row[sourceStatusIdx]).trim() : null,
        copy_text,
        audio_url,
        status,
        notes,
        assets,
      });
    }

    console.log(`[OK] Total de piezas parseadas para ${brand.name}: ${parsedPosts.length} (esperadas: 22)`);

    // Inserción en Supabase si está disponible
    if (supabase && !dryRun) {
      // 1. Workspace
      const { data: wsData, error: wsError } = await supabase
        .from('workspaces')
        .upsert(
          {
            slug: brand.slug,
            name: brand.name,
            accent_color: brand.accent_color,
            badge_label: brand.badge_label,
          },
          { onConflict: 'slug' }
        )
        .select('id')
        .single();

      if (wsError || !wsData) {
        console.error(`[ERROR] Error al upsert workspace ${brand.slug}:`, wsError);
        errorsEncountered++;
        continue;
      }

      const workspaceId = wsData.id;

      // 2. Posts y Assets
      for (const item of parsedPosts) {
        const { data: existingPost, error: existingPostError } = await supabase
          .from('posts')
          .select('status, audio_url')
          .eq('workspace_id', workspaceId)
          .eq('code_id', item.code_id)
          .maybeSingle();
        if (existingPostError) {
          console.error(`[ERROR] No se pudo consultar el estado previo de ${item.code_id}:`, existingPostError.message);
          errorsEncountered++;
          continue;
        }

        const audioUrl = existingPost?.audio_url || item.audio_url;
        const hasAudioAsset = item.assets.some(asset => asset.asset_type === 'audio');
        const status = existingPost?.status === 'published'
          ? 'published'
          : (item.format === 'reel' && !audioUrl && !hasAudioAsset ? 'pending_audio' : 'ready');
        const { data: postData, error: postError } = await supabase
          .from('posts')
          .upsert(
            {
              workspace_id: workspaceId,
              code_id: item.code_id,
              format: item.format,
              scheduled_date: item.scheduled_date,
              scheduled_time: item.scheduled_time,
              source_week: item.source_week,
              source_weekday: item.source_weekday,
              source_level: item.source_level,
              series: item.series,
              theme: item.theme,
              hook: item.hook,
              script: item.script,
              caption_text: item.caption_text,
              hashtags: item.hashtags,
              cta: item.cta,
              source_files: item.source_files,
              source_status: item.source_status,
              copy_text: item.copy_text,
              audio_url: audioUrl,
              status,
              notes: item.notes,
            },
            { onConflict: 'workspace_id,code_id' }
          )
          .select('id')
          .single();

        if (postError || !postData) {
          console.error(`[ERROR] Falló upsert de post ${item.code_id}:`, postError);
          errorsEncountered++;
          continue;
        }

        totalPostsInsertedOrUpdated++;
        const postId = postData.id;

        // Subir assets al Storage y upsert en post_assets
        for (const asset of item.assets) {
          // Subir archivo al bucket
          const { error: uploadError } = await supabase.storage
            .from(MEDIA_BUCKET)
            .upload(asset.storage_path, asset.buffer, {
              contentType: asset.contentType,
              upsert: true,
            });

          if (uploadError) {
            console.error(`[ERROR] Error al subir asset ${asset.storage_path}:`, uploadError.message);
            errorsEncountered++;
            continue;
          }

          // Upsert en post_assets
          const { error: assetDbError } = await supabase
            .from('post_assets')
            .upsert(
              {
                post_id: postId,
                asset_type: asset.asset_type,
                storage_path: asset.storage_path,
                public_url: null,
                order_index: asset.order_index,
              },
              { onConflict: 'post_id,asset_type,order_index' }
            );

          if (assetDbError) {
            console.error(`[ERROR] Error al registrar asset en DB ${asset.storage_path}:`, assetDbError);
            errorsEncountered++;
          } else {
            totalAssetsUploaded++;
          }
        }
      }
    } else {
      // Simular conteo para validación de datos
      for (const p of parsedPosts) {
        totalPostsInsertedOrUpdated++;
        totalAssetsUploaded += p.assets.length;
      }
    }
  }

  console.log(`\n========================================`);
  console.log(`RESUMEN DE EJECUCIÓN`);
  console.log(`========================================`);
  console.log(`Publicaciones procesadas con éxito: ${totalPostsInsertedOrUpdated}`);
  console.log(`Recursos multimedia asociados: ${totalAssetsUploaded}`);
  console.log(`Errores encontrados: ${errorsEncountered}`);

  if (errorsEncountered > 0) {
    console.error(`\n[FALLO] La migración terminó con errores que impiden la integridad completa.`);
    process.exit(1);
  } else {
    console.log(`\n[ÉXITO] Migración y validación completada sin errores.`);
  }
}

runSeed().catch((err) => {
  console.error('[FATAL EXCEPTION]:', err);
  process.exit(1);
});
