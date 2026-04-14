import { flattenPortfolio } from '../scanner.js';
import { enqueueAll, runBatch, isBatchRunning, getStatus } from '../job-manager.js';

const MEDIA_ROOT = process.env.MEDIA_ROOT;

export default async function transcodeRoutes(app) {
  // 일괄 변환 시작
  app.post('/api/transcode', async (request, reply) => {
    if (isBatchRunning()) {
      return reply.code(409).send({
        error: 'Transcoding already in progress',
        ...getStatus(),
      });
    }

    const videos = await flattenPortfolio(MEDIA_ROOT);
    const result = await enqueueAll(videos, MEDIA_ROOT);

    if (result.queued === 0) {
      return { message: 'Nothing to transcode', ...result };
    }

    // 비동기로 배치 실행 (fire-and-forget)
    runBatch(MEDIA_ROOT).catch(err => {
      app.log.error(err, 'Batch transcode failed');
    });

    return { message: 'Transcoding started', ...result };
  });

  // 변환 상태 조회
  app.get('/api/transcode/status', async () => {
    return getStatus();
  });
}
