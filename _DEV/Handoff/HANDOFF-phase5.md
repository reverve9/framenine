# Phase 5: 운영 안정화

## 상태: 완료

## 구현 항목

### 1. PM2 프로세스 매니저
- `ecosystem.config.cjs` 생성
- 자동 재시작, 메모리 제한 (512M)
- 로그 파일 분리: `logs/app.log`, `logs/error.log`
- 타임스탬프 포함 로그

### 2. 로깅
- 개발 모드: `pino-pretty` (컬러 출력)
- 프로덕션 모드: JSON 로그 → 파일 저장

### 3. CORS
- `@fastify/cors` 등록
- `ALLOWED_ORIGINS` 환경변수로 관리
- 개발: `*` 전체 허용 / 프로덕션: 도메인 지정

### 4. 보안 헤더
- `@fastify/helmet` 등록
- CSP 비활성화 (HLS.js CDN + 인라인 스크립트)
- Cross-Origin-Resource-Policy: cross-origin (미디어 리소스 허용)
- X-Frame-Options, HSTS, X-Content-Type-Options 등 적용

### 5. 캐싱 전략

| 리소스 | Cache-Control |
|--------|---------------|
| .ts 세그먼트 | `public, max-age=31536000, immutable` |
| 썸네일 | `public, max-age=86400` |
| .m3u8 플레이리스트 | `no-cache` |
| Portfolio API | `no-cache` |

### 6. .env 정리

```
PORT=3000
MEDIA_ROOT=/Volumes/NINE_DEV/portfolio
NODE_ENV=development
ALLOWED_ORIGINS=*
```

프로덕션 배포 시:
```
NODE_ENV=production
ALLOWED_ORIGINS=https://your-domain.com
```

## 생성/수정 파일

| 파일 | 작업 |
|------|------|
| `ecosystem.config.cjs` | 신규 — PM2 설정 |
| `logs/` | 신규 — 로그 디렉토리 |
| `src/server.js` | 수정 — CORS, helmet, 로거, 캐시 헤더 |
| `src/routes/stream.js` | 수정 — .m3u8 no-cache, 수동 CORS 제거 |
| `.env` | 수정 — NODE_ENV, ALLOWED_ORIGINS 추가 |
| `.gitignore` | 수정 — logs/ 추가 |

## PM2 실행 방법

```bash
# 최초 1회
npm install -g pm2
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup  # 재부팅 후 자동 시작

# 이후
pm2 status
pm2 logs frame-nine
pm2 restart frame-nine
```

## 테스트 결과
- PM2 실행: online 상태, 정상 동작
- health API: env "production" 표시
- CORS: access-control-allow-origin 정상
- Helmet: 보안 헤더 전체 적용
- .ts 캐시: max-age=31536000
- .m3u8 캐시: no-cache
- 썸네일 캐시: max-age=86400
- 로그 파일: app.log 기록, error.log 비어있음

## 참고사항
- ESM 모드이므로 PM2 설정은 `.cjs` 확장자 사용
- `pm2 startup`은 수동 실행 필요 (OS별 명령어 출력됨)
- 프로덕션 배포 시 .env의 NODE_ENV, ALLOWED_ORIGINS 변경 필요
