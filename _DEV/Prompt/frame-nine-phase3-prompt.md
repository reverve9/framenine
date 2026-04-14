# Frame NINE — Phase 3 Claude Code 프롬프트

## 현재 상태

HANDOFF.md 읽고 시작할 것.
Phase 1, 2 완료. 서버 사이드 완성 상태.

- HLS 변환 + ABR 스트리밍 동작 중
- `GET /api/portfolio` — hlsReady, streamUrl 포함 응답
- `/stream/...` — HLS 마스터/variant/세그먼트 서빙 중

## Phase 3 작업 범위

프론트엔드 플레이어 구현. 별도 프레임워크 없이 **Vanilla JS + HTML + CSS** 단일 파일로 구성.

## 구현 항목

### 1. 포트폴리오 브라우징 UI
- 카테고리 탭 (live-commerce / promotion / commercial / event-seminar)
- 연도 필터
- 영상 카드 목록 (파일명 표시, hlsReady 상태 표시)

### 2. HLS.js 기반 영상 플레이어
- HLS.js CDN 사용 (`https://cdn.jsdelivr.net/npm/hls.js@latest`)
- 카드 클릭 시 플레이어에서 재생
- ABR 자동 품질 전환
- 수동 품질 선택 (1080p / 720p / 480p)

### 3. 레이아웃
- 반응형 (데스크탑 우선)
- 좌측: 포트폴리오 목록
- 우측: 플레이어
- 다크 톤 배경 권장 (영상 제작사 분위기)

## 파일 구조 (추가)

```
Frame NINE/
└── src/
    └── public/
        └── index.html    ← 플레이어 + UI 전체 (단일 파일)
```

## Fastify 정적 파일 서빙 추가

`server.js`에 `@fastify/static` 등록해서 `/public` 경로로 서빙.

```
GET / → public/index.html
```

## API 연동

```
GET /api/portfolio → 카테고리/연도/파일 목록 로드
GET /stream/.../master.m3u8 → HLS.js로 재생
```

## 완료 조건

- 브라우저에서 `http://localhost:3000` 접속 시 UI 표시
- 카테고리/연도 필터 동작
- hlsReady: true 인 영상 클릭 시 재생
- hlsReady: false 인 영상은 "변환 필요" 표시
- 품질 수동 선택 동작

## 참고사항

- 이번 Phase에서 디자인 완성도보다 기능 동작 우선
- HANDOFF.md 업데이트 필수
- `@fastify/static` 패키지 설치 필요 (`npm install @fastify/static`)
