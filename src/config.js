import { join, parse } from 'node:path';

export const HLS_DIR = '_hls';
export const SEGMENT_DURATION = 6;

export const VARIANTS = [
  {
    label: '1080p',
    width: 1920,
    height: 1080,
    videoBitrate: '5000k',
    maxrate: '5500k',
    bufsize: '10000k',
    audioBitrate: '192k',
    profile: 'high',
    level: '4.1',
  },
  {
    label: '720p',
    width: 1280,
    height: 720,
    videoBitrate: '2800k',
    maxrate: '3080k',
    bufsize: '5600k',
    audioBitrate: '128k',
    profile: 'main',
    level: '3.1',
  },
  {
    label: '480p',
    width: 854,
    height: 480,
    videoBitrate: '1400k',
    maxrate: '1540k',
    bufsize: '2800k',
    audioBitrate: '96k',
    profile: 'main',
    level: '3.0',
  },
];

export function hlsRoot(mediaRoot) {
  return join(mediaRoot, HLS_DIR);
}

export function videoHlsDir(mediaRoot, category, year, filename) {
  const name = parse(filename).name;
  return join(hlsRoot(mediaRoot), category, year, name);
}

export function videoId(category, year, filename) {
  return `${category}/${year}/${filename}`;
}
