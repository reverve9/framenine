import { createReadStream } from 'node:fs';
import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { hlsRoot } from '../config.js';

const MEDIA_ROOT = process.env.MEDIA_ROOT;

const MIME_TYPES = {
  '.m3u8': 'application/vnd.apple.mpegurl',
  '.ts': 'video/MP2T',
};

async function sendHlsFile(request, reply, filePath) {
  try {
    await access(filePath);
  } catch {
    return reply.code(404).send({ error: 'Not found' });
  }

  const ext = filePath.slice(filePath.lastIndexOf('.'));
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  reply.header('Content-Type', contentType);

  if (ext === '.ts') {
    reply.header('Cache-Control', 'public, max-age=31536000, immutable');
  } else {
    reply.header('Cache-Control', 'no-cache');
  }

  return reply.send(createReadStream(filePath));
}

export default async function streamRoutes(app) {
  // master.m3u8
  app.get('/stream/:category/:year/:name/master.m3u8', async (request, reply) => {
    const { category, year, name } = request.params;
    const filePath = join(hlsRoot(MEDIA_ROOT), category, year, name, 'master.m3u8');
    return sendHlsFile(request, reply, filePath);
  });

  // variant playlist
  app.get('/stream/:category/:year/:name/:variant/stream.m3u8', async (request, reply) => {
    const { category, year, name, variant } = request.params;
    const filePath = join(hlsRoot(MEDIA_ROOT), category, year, name, variant, 'stream.m3u8');
    return sendHlsFile(request, reply, filePath);
  });

  // .ts segments
  app.get('/stream/:category/:year/:name/:variant/:segment', async (request, reply) => {
    const { category, year, name, variant, segment } = request.params;
    const filePath = join(hlsRoot(MEDIA_ROOT), category, year, name, variant, segment);
    return sendHlsFile(request, reply, filePath);
  });
}
