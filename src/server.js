import 'dotenv/config';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { scanPortfolio } from './scanner.js';
import transcodeRoutes from './routes/transcode.js';
import streamRoutes from './routes/stream.js';
import thumbnailRoutes from './routes/thumbnail.js';
import { startWatcher } from './watcher.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const execFileAsync = promisify(execFile);

const PORT = Number(process.env.PORT) || 3000;
const MEDIA_ROOT = process.env.MEDIA_ROOT;
const NODE_ENV = process.env.NODE_ENV || 'development';
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS;

// --- Logger 설정 ---
const loggerConfig = NODE_ENV === 'production'
  ? { level: 'info' }
  : { level: 'info', transport: { target: 'pino-pretty', options: { colorize: true } } };

const app = Fastify({ logger: loggerConfig });

// --- CORS ---
const corsOrigin = ALLOWED_ORIGINS
  ? ALLOWED_ORIGINS.split(',').map(s => s.trim())
  : true; // 개발: 전체 허용

await app.register(cors, { origin: corsOrigin });

// --- Helmet (보안 헤더) ---
await app.register(helmet, {
  contentSecurityPolicy: false, // HLS.js CDN + 인라인 스크립트 허용
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // 미디어 리소스 크로스 오리진 허용
});

// --- 포트폴리오 캐시 ---
let portfolioCache = null;

async function refreshPortfolio() {
  portfolioCache = await scanPortfolio(MEDIA_ROOT);
}

// --- FFmpeg 버전 확인 ---
async function getFfmpegVersion() {
  try {
    const { stdout } = await execFileAsync('ffmpeg', ['-version']);
    const match = stdout.match(/ffmpeg version (\S+)/);
    return match ? match[1] : 'unknown';
  } catch {
    return 'unavailable';
  }
}

// --- Routes ---

app.get('/api/health', async () => {
  const ffmpegVersion = await getFfmpegVersion();

  return {
    status: 'ok',
    ffmpeg: ffmpegVersion,
    mediaRoot: MEDIA_ROOT,
    env: NODE_ENV,
  };
});

app.get('/api/portfolio', async (request, reply) => {
  await refreshPortfolio();
  reply.header('Cache-Control', 'no-cache');
  return { categories: portfolioCache ?? [] };
});

// 수동 스캔: 포트폴리오 갱신 + 변환/썸네일 자동 실행
app.post('/api/scan', async (request, reply) => {
  await refreshPortfolio();
  const { flattenPortfolio } = await import('./scanner.js');
  const { enqueueAll, runBatch, isBatchRunning } = await import('./job-manager.js');
  const { generateThumbnail } = await import('./thumbnail.js');
  const { saveMetadata } = await import('./metadata.js');

  const videos = await flattenPortfolio(MEDIA_ROOT);
  const result = await enqueueAll(videos, MEDIA_ROOT);

  if (result.queued > 0 && !isBatchRunning()) {
    runBatch(MEDIA_ROOT)
      .then(async () => {
        const all = await flattenPortfolio(MEDIA_ROOT);
        for (const v of all) {
          try {
            await generateThumbnail(v.inputPath, MEDIA_ROOT, v.category, v.year, v.filename);
            await saveMetadata(v.inputPath, MEDIA_ROOT, v.category, v.year, v.filename);
          } catch {}
        }
      })
      .catch((err) => app.log.error(err, '[scan] 변환 오류'));
  } else if (result.queued === 0) {
    // 변환 불필요 — 썸네일/메타만 갱신
    (async () => {
      for (const v of videos) {
        try {
          await generateThumbnail(v.inputPath, MEDIA_ROOT, v.category, v.year, v.filename);
          await saveMetadata(v.inputPath, MEDIA_ROOT, v.category, v.year, v.filename);
        } catch {}
      }
    })().catch(() => {});
  }

  return { message: 'Scan started', total: videos.length, queued: result.queued, skipped: result.skipped };
});

await app.register(fastifyStatic, {
  root: join(__dirname, 'public'),
  prefix: '/',
});

await app.register(transcodeRoutes);
await app.register(streamRoutes);
await app.register(thumbnailRoutes);

// --- Start ---

async function start() {
  await refreshPortfolio();
  app.log.info(`[scanner] ${portfolioCache.length} categories found`);

  await app.listen({ port: PORT, host: '0.0.0.0' });
  startWatcher(app.log);
}

start().catch((err) => {
  app.log.error(err);
  process.exit(1);
});
