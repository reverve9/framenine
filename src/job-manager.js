import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { videoHlsDir } from './config.js';
import { probeVideo, filterVariants, transcodeVariant, generateMasterPlaylist } from './transcoder.js';

const jobs = new Map();
let batchRunning = false;

/**
 * 포트폴리오 영상 목록을 받아 변환 작업을 큐에 등록한다.
 * 이미 master.m3u8이 존재하는 영상은 skipped 처리한다.
 */
export async function enqueueAll(videos, mediaRoot) {
  jobs.clear();
  let skipped = 0;

  for (const v of videos) {
    const hlsDir = videoHlsDir(mediaRoot, v.category, v.year, v.filename);
    const masterPath = join(hlsDir, 'master.m3u8');

    let alreadyDone = false;
    try {
      await access(masterPath);
      alreadyDone = true;
    } catch {}

    const id = `${v.category}/${v.year}/${v.filename}`;

    if (alreadyDone) {
      jobs.set(id, { videoId: id, inputPath: v.inputPath, status: 'skipped' });
      skipped++;
    } else {
      jobs.set(id, {
        videoId: id,
        inputPath: v.inputPath,
        status: 'pending',
        currentVariant: null,
        progress: null,
        error: null,
      });
    }
  }

  return { total: videos.length, skipped, queued: videos.length - skipped };
}

/**
 * 큐에 등록된 작업을 순차적으로 실행한다.
 */
export async function runBatch(mediaRoot) {
  if (batchRunning) return false;
  batchRunning = true;

  try {
    for (const [id, job] of jobs) {
      if (job.status !== 'pending') continue;

      job.status = 'probing';

      try {
        const info = await probeVideo(job.inputPath);
        const variants = filterVariants(info.width, info.height);

        if (variants.length === 0) {
          job.status = 'skipped';
          continue;
        }

        const hlsDir = videoHlsDir(
          mediaRoot,
          ...id.split('/').slice(0, 2),
          id.split('/')[2],
        );
        await mkdir(hlsDir, { recursive: true });

        job.status = 'transcoding';
        const completedVariants = [];

        for (const variant of variants) {
          job.currentVariant = variant.label;
          job.progress = { percent: 0, fps: 0, timemark: '00:00:00.00' };

          await transcodeVariant(job.inputPath, hlsDir, variant, (p) => {
            job.progress = {
              percent: Math.round((p.percent || 0) * 10) / 10,
              fps: p.currentFps || 0,
              timemark: p.timemark || '',
            };
          });

          completedVariants.push(variant);
        }

        await generateMasterPlaylist(hlsDir, completedVariants);
        job.status = 'completed';
        job.currentVariant = null;
        job.progress = null;
      } catch (err) {
        job.status = 'failed';
        job.error = err.message;
      }
    }
  } finally {
    batchRunning = false;
  }

  return true;
}

export function isBatchRunning() {
  return batchRunning;
}

export function getStatus() {
  const summary = { running: batchRunning, total: 0, completed: 0, failed: 0, skipped: 0, inProgress: 0, pending: 0, jobs: [] };

  for (const job of jobs.values()) {
    summary.total++;
    if (job.status === 'completed') summary.completed++;
    else if (job.status === 'failed') summary.failed++;
    else if (job.status === 'skipped') summary.skipped++;
    else if (job.status === 'transcoding' || job.status === 'probing') summary.inProgress++;
    else if (job.status === 'pending') summary.pending++;

    summary.jobs.push({
      videoId: job.videoId,
      status: job.status,
      currentVariant: job.currentVariant || undefined,
      progress: job.progress || undefined,
      error: job.error || undefined,
    });
  }

  return summary;
}
