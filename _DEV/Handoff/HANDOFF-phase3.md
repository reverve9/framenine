# Phase 3: 프론트엔드 플레이어

## 상태: 완료

## 구현 항목

### 1. 포트폴리오 브라우징 UI
- 카테고리 탭 (commercial / live-commerce / promotion 등)
- 연도 필터 (ALL / 연도별 토글)
- 영상 카드 목록 (파일명 + 연도, READY / 변환 필요 뱃지)

### 2. HLS.js 플레이어
- HLS.js CDN 연동 (`hls.js@latest`)
- 카드 클릭 시 HLS 스트리밍 재생
- ABR 자동 품질 전환
- 수동 품질 선택 (AUTO / 1080p / 720p / 480p)
- Safari native HLS fallback 지원

### 3. 레이아웃
- 좌측 사이드바 (360px) — 카테고리/연도/영상 목록
- 우측 — 플레이어 영역
- 다크 톤 배경
- 반응형 (768px 이하 세로 배치)

## 생성/수정 파일

| 파일 | 작업 |
|------|------|
| `src/public/index.html` | 신규 — Vanilla JS + HTML + CSS 단일 파일 |
| `src/server.js` | 수정 — @fastify/static 등록 (`/` → public/) |

## API 연동

```
GET /api/portfolio → 카테고리/연도/파일 목록 + hlsReady/streamUrl
GET /stream/.../master.m3u8 → HLS.js 재생 소스
```

## 접속 방법

```
http://localhost:3000
```

## 테스트 결과
- 브라우저 접속 → UI 정상 표시
- 카테고리 탭 전환 → 정상
- 연도 필터 → 정상
- hlsReady: true 영상 클릭 → HLS 재생 정상
- hlsReady: false 영상 → "변환 필요" 뱃지, 클릭 비활성
- 품질 수동 선택 → 정상 전환
- 반응형 → 768px 이하 세로 레이아웃 전환

## 참고사항
- `@fastify/static`은 Phase 2에서 이미 설치됨 (추가 설치 불필요)
- Vanilla JS 단일 파일 — 빌드 과정 없음
- 디자인 완성도보다 기능 동작 우선 (프롬프트 지침)
