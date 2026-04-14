import { createReadStream } from 'node:fs';
import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { flattenPortfolio } from '../scanner.js';
import { generateThumbnail } from '../thumbnail.js';
import { saveMetadata } from '../metadata.js';
import { hlsRoot } from '../config.js';

import { requireAuth } from '../auth.js';

const MEDIA_ROOT = process.env.MEDIA_ROOT;

let thumbRunning = false;
let thumbStatus = { running: false, total: 0, completed: 0, failed: 0, skipped: 0, jobs: [] };

export default async function thumbnailRoutes(app) {
  // 일괄 썸네일 + 메타데이터 생성
  app.post('/api/thumbnail', { preHandler: requireAuth }, async (request, reply) => {
    if (thumbRunning) {
      return reply.code(409).send({ error: 'Thumbnail generation already in progress', ...thumbStatus });
    }

    const videos = await flattenPortfolio(MEDIA_ROOT);
    thumbStatus = { running: true, total: videos.length, completed: 0, failed: 0, skipped: 0, jobs: [] };
    thumbRunning = true;

    // fire-and-forget
    (async () => {
      for (const v of videos) {
        const id = `${v.category}/${v.year}/${v.filename}`;
        try {
          // 썸네일 생성
          const result = await generateThumbnail(v.inputPath, MEDIA_ROOT, v.category, v.year, v.filename);

          // 메타데이터 추출 + 캐시
          await saveMetadata(v.inputPath, MEDIA_ROOT, v.category, v.year, v.filename);

          if (result.status === 'skipped') {
            thumbStatus.skipped++;
          } else {
            thumbStatus.completed++;
          }
          thumbStatus.jobs.push({ videoId: id, status: result.status });
        } catch (err) {
          thumbStatus.failed++;
          thumbStatus.jobs.push({ videoId: id, status: 'failed', error: err.message });
        }
      }
      thumbStatus.running = false;
      thumbRunning = false;
    })().catch(() => { thumbRunning = false; thumbStatus.running = false; });

    return { message: 'Thumbnail generation started', total: videos.length };
  });

  // 진행률 조회
  app.get('/api/thumbnail/status', async () => {
    return thumbStatus;
  });

  // 썸네일 이미지 서빙
  app.get('/thumb/:category/:year/:name/thumbnail.jpg', async (request, reply) => {
    const { category, year, name } = request.params;
    const filePath = join(hlsRoot(MEDIA_ROOT), category, year, name, 'thumbnail.jpg');

    try {
      await access(filePath);
    } catch {
      return reply.code(404).send({ error: 'Not found' });
    }

    reply
      .header('Content-Type', 'image/jpeg')
      .header('Cache-Control', 'public, max-age=86400');

    return reply.send(createReadStream(filePath));
  });
}
