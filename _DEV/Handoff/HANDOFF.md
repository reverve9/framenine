# Frame NINE — Handoff Index

## 진행 현황

| Phase | 상태 | 요약 | 파일 |
|-------|------|------|------|
| 1     | 완료 | 폴더 스캔 + 기본 API | [HANDOFF-phase1.md](HANDOFF-phase1.md) |
| 2     | 완료 | HLS 변환 + ABR 스트리밍 | [HANDOFF-phase2.md](HANDOFF-phase2.md) |
| 3     | 완료 | 프론트엔드 플레이어 | [HANDOFF-phase3.md](HANDOFF-phase3.md) |
| 4     | 완료 | 썸네일 + 메타데이터 | [HANDOFF-phase4.md](HANDOFF-phase4.md) |
| 5     | 완료 | 운영 안정화 | [HANDOFF-phase5.md](HANDOFF-phase5.md) |

## 프로젝트 구조 (최종)

```
Frame NINE/
├── .env                       # PORT, MEDIA_ROOT, NODE_ENV, ALLOWED_ORIGINS
├── .gitignore
├── package.json
├── ecosystem.config.cjs       # PM2 설정
├── logs/                      # PM2 로그 (app.log, error.log)
├── src/
│   ├── server.js              # Fastify 서버 (CORS, Helmet, 라우트 등록)
│   ├── scanner.js             # 폴더 스캔 + hlsReady/thumbnailUrl/meta
│   ├── config.js              # 비트레이트 래더, 경로 헬퍼
│   ├── transcoder.js          # ffprobe + HLS 변환
│   ├── job-manager.js         # 변환 작업 큐/상태 관리
│   ├── thumbnail.js           # FFmpeg 썸네일 추출
│   ├── metadata.js            # ffprobe 메타데이터 추출/캐시
│   ├── public/
│   │   └── index.html         # 프론트엔드 (Vanilla JS 단일 파일)
│   └── routes/
│       ├── transcode.js       # POST /api/transcode, GET /api/transcode/status
│       ├── stream.js          # HLS 파일 서빙 (/stream/...)
│       └── thumbnail.js       # POST /api/thumbnail, GET /thumb/...
└── _dev/
    ├── Handoff/               # Phase별 핸드오프 문서
    └── Prompt/                # Phase별 프롬프트
```

## API 전체 목록

| Method | Path | 설명 |
|--------|------|------|
| GET    | `/` | 프론트엔드 UI |
| GET    | `/api/health` | 서버 상태 + FFmpeg 버전 |
| GET    | `/api/portfolio` | 포트폴리오 목록 (hlsReady, thumbnailUrl, meta) |
| POST   | `/api/transcode` | HLS 일괄 변환 시작 |
| GET    | `/api/transcode/status` | 변환 진행률 |
| POST   | `/api/thumbnail` | 썸네일 + 메타데이터 일괄 생성 |
| GET    | `/api/thumbnail/status` | 썸네일 생성 진행률 |
| GET    | `/stream/:category/:year/:name/master.m3u8` | ABR 마스터 플레이리스트 |
| GET    | `/stream/:category/:year/:name/:variant/stream.m3u8` | variant 플레이리스트 |
| GET    | `/stream/:category/:year/:name/:variant/:segment` | .ts 세그먼트 |
| GET    | `/thumb/:category/:year/:name/thumbnail.jpg` | 썸네일 이미지 |

## 실행 방법

```bash
# 개발
npm run dev

# 프로덕션 (PM2)
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup    # 재부팅 자동 시작 등록 (최초 1회)

# 초기 데이터 세팅 (서버 실행 후)
curl -X POST http://localhost:3000/api/transcode    # HLS 변환
curl -X POST http://localhost:3000/api/thumbnail    # 썸네일 생성
```

## 환경

- Node.js v25.2.1 / FFmpeg 8.1 / PM2
- MEDIA_ROOT=/Volumes/NINE_DEV/portfolio
- PORT=3000
