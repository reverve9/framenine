# Frame NINE — Phase 5 Claude Code 프롬프트

## 현재 상태

HANDOFF.md 읽고 시작할 것.
Phase 1, 2, 3, 4 완료 상태.

- HLS 변환 + ABR 스트리밍 동작 중
- 프론트엔드 플레이어 동작 중
- 썸네일 + 메타데이터 API 동작 중

## Phase 5 작업 범위

운영 안정화. 맥미니에서 서버를 안정적으로 상시 운영할 수 있는 상태로 만드는 것이 목표.

## 구현 항목

### 1. PM2 프로세스 매니저 연동
- PM2 설정 파일 (`ecosystem.config.cjs`) 생성
- 서버 크래시 시 자동 재시작
- 맥미니 재부팅 후 자동 시작 (`pm2 startup` 등록)
- 로그 파일 저장 설정

### 2. 로깅 정리
- Fastify 기본 로그 → pino-pretty 적용 (개발 모드)
- 프로덕션 모드 로그 파일 저장 (`logs/app.log`)
- 에러 로그 별도 저장 (`logs/error.log`)
- 인코딩/썸네일 작업 진행 로그 정리

### 3. CORS 설정
- `@fastify/cors` 등록
- 허용 오리진: `.env`의 `ALLOWED_ORIGINS`로 관리
- 개발: `*` 허용, 프로덕션: 홈페이지 도메인만 허용

### 4. 보안 헤더
- `@fastify/helmet` 등록
- 기본 보안 헤더 적용
- HLS/썸네일 서빙 경로는 helmet 예외 처리

### 5. 캐싱 전략
- 썸네일 응답: `Cache-Control: max-age=86400` (24시간)
- HLS 세그먼트 (.ts): `Cache-Control: max-age=31536000` (1년)
- HLS 마스터/variant (.m3u8): `Cache-Control: no-cache`
- Portfolio API: `Cache-Control: no-cache`

### 6. .env 정리

```
PORT=3000
MEDIA_ROOT=/Volumes/NINE_MEDIA/portfolio
ALLOWED_ORIGINS=https://your-domain.com
NODE_ENV=production
```

## 생성/수정 파일

```
Frame NINE/
├── ecosystem.config.cjs     ← 신규 — PM2 설정
├── logs/                    ← 신규 — 로그 저장 디렉토리
│   ├── app.log
│   └── error.log
├── .env                     ← 수정 — ALLOWED_ORIGINS, NODE_ENV 추가
└── src/
    └── server.js            ← 수정 — CORS, helmet, 캐시 헤더 적용
```

## PM2 실행 방법

```bash
# 최초 1회
npm install -g pm2
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup  # 재부팅 후 자동 시작 등록

# 이후
pm2 status          # 상태 확인
pm2 logs frame-nine # 로그 확인
pm2 restart frame-nine
```

## 완료 조건

- `pm2 start` 후 서버 정상 동작
- 맥미니 재부팅 후 서버 자동 시작
- `pm2 logs`에서 요청 로그 확인
- CORS 헤더 정상 응답
- 썸네일/HLS 세그먼트 캐시 헤더 확인

## 참고사항

- PM2는 글로벌 설치 필요 (`npm install -g pm2`)
- ESM 모드이므로 ecosystem 파일은 `.cjs` 확장자 사용
- HANDOFF.md 최종 업데이트 필수 (전체 Phase 완료 표시)
