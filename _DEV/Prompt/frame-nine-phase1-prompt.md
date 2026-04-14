# Frame NINE — Phase 1 Claude Code 프롬프트

## 프로젝트 개요

영상 제작사 포트폴리오 스트리밍 서버.
맥미니에 연결된 외장하드의 MP4 영상 파일을 HLS로 변환해 스트리밍하는 Node.js 서버.
프로젝트명: **Frame NINE**

## 기술 스택

- Node.js + Fastify
- fluent-ffmpeg (FFmpeg 래퍼)
- 언어: JavaScript (ESM)

## 외장하드 폴더 구조

```
portfolio/
├── live-commerce/
│   ├── 2024/
│   └── 2025/
├── promotion/
│   ├── 2024/
│   └── 2025/
├── commercial/
│   ├── 2024/
│   └── 2025/
└── event-seminar/
    ├── 2024/
    └── 2025/
```

## Phase 1 작업 범위

1. Fastify 프로젝트 초기 세팅
2. FFmpeg 설치 확인 및 fluent-ffmpeg 연동
3. 외장하드 폴더 스캔 로직
   - 장르(카테고리) 자동 인식
   - 연도 자동 인식
   - MP4 파일 목록 추출
4. 스캔 결과를 JSON으로 반환하는 기본 API

## API

- `GET /api/health` — 서버 상태 및 FFmpeg 버전 확인
- `GET /api/portfolio` — 전체 포트폴리오 목록 반환 (장르/연도/파일명 구조)

## 완료 조건

- 서버 실행 시 외장하드 폴더 자동 스캔
- `GET /api/portfolio` 호출 시 아래 형태의 JSON 반환

```json
{
  "categories": [
    {
      "name": "live-commerce",
      "years": [
        {
          "year": "2025",
          "files": ["영상1.mp4", "영상2.mp4"]
        }
      ]
    }
  ]
}
```

- `GET /api/health` 에서 FFmpeg 버전 정상 출력

## 참고사항

- 외장하드 마운트 경로는 `.env`로 관리 (`MEDIA_ROOT`)
- `HANDOFF.md` 작성 필수 (dev-workflow 규칙 준수)
- 이번 Phase에서 인코딩 로직은 구현하지 않음 — Phase 2에서 진행
