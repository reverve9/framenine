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
}

start().catch((err) => {
  app.log.error(err);
  process.exit(1);
});
