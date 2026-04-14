import { access, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import ffmpeg from 'fluent-ffmpeg';
import { videoHlsDir } from './config.js';

const THUMB_WIDTH = 640;
const THUMB_HEIGHT = 360;
const THUMB_FILENAME = 'thumbnail.jpg';

/**
 * 영상 중간 지점에서 썸네일을 추출한다.
 * 이미 존재하면 스킵.
 */
export async function generateThumbnail(inputPath, mediaRoot, category, year, filename) {
  const hlsDir = videoHlsDir(mediaRoot, category, year, filename);
  const thumbPath = join(hlsDir, THUMB_FILENAME);

  // 이미 존재하면 스킵
  try {
    await access(thumbPath);
    return { status: 'skipped', path: thumbPath };
  } catch {}

  await mkdir(hlsDir, { recursive: true });

  // 영상 길이 조회
  const duration = await new Promise((resolve, reject) => {
    ffmpeg.ffprobe(inputPath, (err, metadata) => {
      if (err) return reject(err);
      resolve(parseFloat(metadata.format.duration) || 0);
    });
  });

  const seekTime = Math.max(0, duration / 2);

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .seekInput(seekTime)
      .frames(1)
      .outputOptions([
        `-vf scale=${THUMB_WIDTH}:${THUMB_HEIGHT}:force_original_aspect_ratio=decrease,pad=${THUMB_WIDTH}:${THUMB_HEIGHT}:(ow-iw)/2:(oh-ih)/2:black`,
      ])
      .output(thumbPath)
      .on('end', () => resolve({ status: 'created', path: thumbPath }))
      .on('error', (err) => reject(err))
      .run();
  });
}
