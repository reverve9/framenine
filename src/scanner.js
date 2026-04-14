import { access, readFile, readdir } from 'node:fs/promises';
import { join, parse } from 'node:path';
import { HLS_DIR } from './config.js';

/**
 * 외장하드 portfolio 폴더를 스캔하여
 * 카테고리 > 연도 > MP4 파일 목록 구조로 반환한다.
 */
export async function scanPortfolio(mediaRoot) {
  const categories = [];

  let categoryDirs;
  try {
    categoryDirs = await readdir(mediaRoot, { withFileTypes: true });
  } catch {
    return categories;
  }

  for (const catEntry of categoryDirs) {
    if (!catEntry.isDirectory() || catEntry.name.startsWith('.') || catEntry.name === HLS_DIR) continue;

    const catPath = join(mediaRoot, catEntry.name);
    const years = [];

    let yearDirs;
    try {
      yearDirs = await readdir(catPath, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const yearEntry of yearDirs) {
      if (!yearEntry.isDirectory() || yearEntry.name.startsWith('.')) continue;

      const yearPath = join(catPath, yearEntry.name);
      let fileEntries;
      try {
        fileEntries = await readdir(yearPath, { withFileTypes: true });
      } catch {
        continue;
      }

      const mp4Files = fileEntries.filter(f => f.isFile() && f.name.toLowerCase().endsWith('.mp4'));
      const files = [];

      for (const f of mp4Files) {
        const baseName = parse(f.name).name;
        const hlsDir = join(mediaRoot, HLS_DIR, catEntry.name, yearEntry.name, baseName);
        const encodedCat = encodeURIComponent(catEntry.name);
        const encodedName = encodeURIComponent(baseName);

        let hlsReady = false;
        try {
          await access(join(hlsDir, 'master.m3u8'));
          hlsReady = true;
        } catch {}

        let hasThumbnail = false;
        try {
          await access(join(hlsDir, 'thumbnail.jpg'));
          hasThumbnail = true;
        } catch {}

        let meta = null;
        try {
          const raw = await readFile(join(hlsDir, 'meta.json'), 'utf-8');
          meta = JSON.parse(raw);
        } catch {}

        files.push({
          filename: f.name,
          hlsReady,
          streamUrl: hlsReady
            ? `/stream/${encodedCat}/${yearEntry.name}/${encodedName}/master.m3u8`
            : null,
          thumbnailUrl: hasThumbnail
            ? `/thumb/${encodedCat}/${yearEntry.name}/${encodedName}/thumbnail.jpg`
            : null,
          meta,
        });
      }

      if (files.length > 0) {
        years.push({ year: yearEntry.name, files });
      }
    }

    categories.push({ name: catEntry.name, years });
  }

  return categories;
}

/**
 * 포트폴리오를 플랫 목록으로 반환한다. (변환 큐 등록용)
 */
export async function flattenPortfolio(mediaRoot) {
  const categories = await scanPortfolio(mediaRoot);
  const flat = [];

  for (const cat of categories) {
    for (const yr of cat.years) {
      for (const file of yr.files) {
        flat.push({
          category: cat.name,
          year: yr.year,
          filename: file.filename,
          inputPath: join(mediaRoot, cat.name, yr.year, file.filename),
        });
      }
    }
  }

  return flat;
}
