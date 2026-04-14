import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import ffmpeg from 'fluent-ffmpeg';
import { videoHlsDir } from './config.js';

/**
 * ffprobe로 영상 메타데이터를 추출한다.
 */
export function extractMetadata(inputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(inputPath, (err, metadata) => {
      if (err) return reject(err);

      const video = metadata.streams.find(s => s.codec_type === 'video');
      const format = metadata.format;

      resolve({
        duration: Math.round(parseFloat(format.duration) || 0),
        width: video ? video.width : 0,
        height: video ? video.height : 0,
        fileSize: parseInt(format.size) || 0,
        bitrate: parseInt(format.bit_rate) || 0,
      });
    });
  });
}

/**
 * 메타데이터를 meta.json으로 저장한다.
 * 이미 존재하면 스킵.
 */
export async function saveMetadata(inputPath, mediaRoot, category, year, filename) {
  const hlsDir = videoHlsDir(mediaRoot, category, year, filename);
  const metaPath = join(hlsDir, 'meta.json');

  try {
    const existing = await readFile(metaPath, 'utf-8');
    return JSON.parse(existing);
  } catch {}

  const { mkdir } = await import('node:fs/promises');
  await mkdir(hlsDir, { recursive: true });

  const meta = await extractMetadata(inputPath);
  await writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf-8');
  return meta;
}

/**
 * 캐시된 meta.json을 읽는다. 없으면 null.
 */
export async function readCachedMeta(mediaRoot, category, year, filename) {
  const hlsDir = videoHlsDir(mediaRoot, category, year, filename);
  const metaPath = join(hlsDir, 'meta.json');

  try {
    const data = await readFile(metaPath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}
