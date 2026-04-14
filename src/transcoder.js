import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import ffmpeg from 'fluent-ffmpeg';
import { VARIANTS, SEGMENT_DURATION } from './config.js';

/**
 * ffprobe로 원본 영상 정보를 가져온다.
 */
export function probeVideo(inputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(inputPath, (err, metadata) => {
      if (err) return reject(err);

      const video = metadata.streams.find(s => s.codec_type === 'video');
      if (!video) return reject(new Error('No video stream found'));

      resolve({
        width: video.width,
        height: video.height,
        duration: parseFloat(metadata.format.duration) || 0,
        fps: Math.round(eval(video.r_frame_rate)) || 30,
      });
    });
  });
}

/**
 * 원본 해상도보다 큰 variant는 제외한다.
 */
export function filterVariants(sourceWidth, sourceHeight) {
  return VARIANTS.filter(v => v.width <= sourceWidth && v.height <= sourceHeight);
}

/**
 * 단일 variant를 HLS로 변환한다.
 */
export function transcodeVariant(inputPath, outputDir, variant, onProgress) {
  return new Promise(async (resolve, reject) => {
    const variantDir = join(outputDir, variant.label);
    await rm(variantDir, { recursive: true, force: true });
    await mkdir(variantDir, { recursive: true });

    const segmentPattern = join(variantDir, 'segment%03d.ts');
    const playlistPath = join(variantDir, 'stream.m3u8');

    ffmpeg(inputPath)
      .videoCodec('libx264')
      .audioCodec('aac')
      .videoBitrate(variant.videoBitrate)
      .audioBitrate(variant.audioBitrate)
      .outputOptions([
        '-pix_fmt', 'yuv420p',
        '-preset', variant.preset || 'medium',
        '-profile:v', variant.profile,
        '-level', variant.level,
        '-maxrate', variant.maxrate,
        '-bufsize', variant.bufsize,
        '-vf', `scale=${variant.width}:${variant.height}`,
        '-force_key_frames', `expr:gte(t,n_forced*${SEGMENT_DURATION})`,
        '-f', 'hls',
        '-hls_time', String(SEGMENT_DURATION),
        '-hls_list_size', '0',
        '-hls_segment_filename', segmentPattern,
      ])
      .output(playlistPath)
      .on('start', (cmd) => {
        console.log('[ffmpeg cmd]', cmd);
      })
      .on('progress', (progress) => {
        if (onProgress) onProgress(progress);
      })
      .on('end', () => resolve())
      .on('error', (err, stdout, stderr) => {
        console.error('[ffmpeg stderr]', stderr);
        reject(err);
      })
      .run();
  });
}

/**
 * master.m3u8 ABR 마스터 플레이리스트를 생성한다.
 */
export async function generateMasterPlaylist(outputDir, completedVariants) {
  let content = '#EXTM3U\n';

  for (const v of completedVariants) {
    const bandwidth = (parseInt(v.videoBitrate) + parseInt(v.audioBitrate)) * 1000;
    content += `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},RESOLUTION=${v.width}x${v.height}\n`;
    content += `${v.label}/stream.m3u8\n`;
  }

  await writeFile(join(outputDir, 'master.m3u8'), content, 'utf-8');
}
