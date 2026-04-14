# Phase 1: 포트폴리오 스캔 + 기본 API

## 상태: 완료

## 환경
- **FFmpeg 8.1** (Homebrew), **Node.js** v25.2.1
- ESM 모드 (`"type": "module"`)
- 의존성: `fastify`, `fluent-ffmpeg`, `dotenv`

## 완료 항목
- Fastify 프로젝트 초기 세팅
- 외장하드 폴더 스캔 (카테고리/연도/MP4)
- `GET /api/health` — 서버 상태 + FFmpeg 버전
- `GET /api/portfolio` — 포트폴리오 JSON 반환

## 생성 파일

```
src/server.js    — Fastify 서버 + 라우트
src/scanner.js   — 외장하드 폴더 스캔 모듈
.env             — MEDIA_ROOT, PORT
.gitignore
```

## 스캔 로직
- `MEDIA_ROOT` 환경변수 기반 (`/Volumes/NINE_DEV/portfolio`)
- 3단계 구조: 카테고리 → 연도 → `.mp4` 파일
- 숨김 폴더 자동 제외, 경로 없으면 빈 배열

## 테스트 결과

```
GET /api/health     → { status: "ok", ffmpeg: "8.1" }
GET /api/portfolio  → { categories: [{ name, years: [{ year, files }] }] }
```
