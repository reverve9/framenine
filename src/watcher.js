import chokidar from 'chokidar';
import { flattenPortfolio } from './scanner.js';
import { enqueueAll, runBatch, isBatchRunning } from './job-manager.js';
import { generateThumbnail } from './thumbnail.js';
import { saveMetadata } from './metadata.js';

const MEDIA_ROOT = process.env.MEDIA_ROOT;

let pendingRun = false;

/**
 * 변환 + 썸네일을 순차 실행한다.
 * 이미 배치가 돌고 있으면 완료 후 한 번 더 실행(pendingRun 플래그).
 */
async function triggerProcessing(log) {
  if (isBatchRunning()) {
    pendingRun = true;
    return;
  }

  const videos = await flattenPortfolio(MEDIA_ROOT);
  const result = await enqueueAll(videos, MEDIA_ROOT);

  if (result.queued === 0) {
    log.info('[watcher] 새 변환 대상 없음');
    return;
  }

  log.info(`[watcher] ${result.queued}개 변환 시작`);

  runBatch(MEDIA_ROOT)
    .then(async () => {
      log.info('[watcher] 변환 완료 → 썸네일 생성 시작');
      const all = await flattenPortfolio(MEDIA_ROOT);
      for (const v of all) {
        try {
          await generateThumbnail(v.inputPath, MEDIA_ROOT, v.category, v.year, v.filename);
          await saveMetadata(v.inputPath, MEDIA_ROOT, v.category, v.year, v.filename);
        } catch (err) {
          log.warn(`[watcher] 썸네일 실패: ${v.filename} — ${err.message}`);
        }
      }
      log.info('[watcher] 썸네일 생성 완료');

      if (pendingRun) {
        pendingRun = false;
        triggerProcessing(log);
      }
    })
    .catch((err) => {
      log.error(err, '[watcher] 변환 배치 오류');
    });
}

/**
 * MEDIA_ROOT 를 감시하다 새 .mp4 파일이 안정되면 자동 처리한다.
 */
export function startWatcher(log) {
  const watcher = chokidar.watch(MEDIA_ROOT, {
    ignored: [
      /(^|[/\\])\../,   // dot 파일
      /_hls/,           // 변환 출력 디렉토리
      /_shared/,        // 파일 공유 디렉토리
      /\.tmp$/,
      /\.part$/,
    ],
    persistent: true,
    ignoreInitial: true,
    depth: 4,
    awaitWriteFinish: {
      stabilityThreshold: 8000,  // 8초 동안 파일 크기 변화 없으면 안정 판정
      pollInterval: 2000,
    },
  });

  watcher.on('add', (filePath) => {
    if (!filePath.toLowerCase().endsWith('.mp4')) return;
    log.info(`[watcher] 새 파일 감지: ${filePath}`);
    triggerProcessing(log).catch((err) => log.error(err, '[watcher] 처리 오류'));
  });

  watcher.on('error', (err) => log.error(err, '[watcher] 감시 오류'));

  log.info(`[watcher] 감시 시작 → ${MEDIA_ROOT}`);
  return watcher;
}
