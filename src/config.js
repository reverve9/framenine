import { join, parse } from 'node:path';

export const HLS_DIR = '_hls';
export const SHARE_DIR = '_shared';
export const SEGMENT_DURATION = 6;

export const VARIANTS = [
  {
    label: '1080p',
    width: 1920,
    height: 1080,
    videoBitrate: '10000k',
    maxrate: '11000k',
    bufsize: '20000k',
    audioBitrate: '192k',
    profile: 'high',
    level: '4.1',
    preset: 'medium',
  },
  {
    label: '720p',
    width: 1280,
    height: 720,
    videoBitrate: '5000k',
    maxrate: '5500k',
    bufsize: '10000k',
    audioBitrate: '128k',
    profile: 'main',
    level: '3.1',
    preset: 'medium',
  },
  {
    label: '480p',
    width: 854,
    height: 480,
    videoBitrate: '2500k',
    maxrate: '2750k',
    bufsize: '5000k',
    audioBitrate: '96k',
    profile: 'main',
    level: '3.0',
    preset: 'medium',
  },
];

export function hlsRoot(mediaRoot) {
  return join(mediaRoot, HLS_DIR);
}

// HLS 디렉토리 이름에서 공백 제거 (fluent-ffmpeg가 공백을 인수 구분자로 오해)
export function sanitizeName(filename) {
  return parse(filename).name.replace(/\s+/g, '_');
}

export function videoHlsDir(mediaRoot, category, year, filename) {
  return join(hlsRoot(mediaRoot), category, year, sanitizeName(filename));
}

export function videoId(category, year, filename) {
  return `${category}/${year}/${filename}`;
}
