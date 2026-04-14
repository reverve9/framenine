# Frame NINE — Phase 4 Claude Code 프롬프트

## 현재 상태

HANDOFF.md 읽고 시작할 것.
Phase 1, 2, 3 완료 상태.

- HLS 변환 + ABR 스트리밍 동작 중
- 프론트엔드 플레이어 동작 중 (`http://localhost:3000`)
- `GET /api/portfolio` — hlsReady, streamUrl 포함 응답

## Phase 4 작업 범위

썸네일 자동 생성 + 메타데이터 추출 + UI 반영.

## 구현 항목

### 1. 썸네일 자동 생성 (FFmpeg)
- 영상 중간 지점에서 프레임 추출
- 저장 위치: `_hls/{category}/{year}/{name}/thumbnail.jpg`
- 해상도: 640×360 (16:9 고정)
- 이미 생성된 썸네일은 스킵 (멱등성)

### 2. 메타데이터 추출 (ffprobe)
- 영상 길이 (duration, 초 단위)
- 해상도 (width × height)
- 파일 크기 (bytes)
- 원본 비트레이트
- 캐시 저장: `_hls/{category}/{year}/{name}/meta.json`

### 3. API 추가

| Method | Path | 설명 |
|--------|------|------|
| `POST` | `/api/thumbnail` | 전체 썸네일 일괄 생성 |
| `GET` | `/api/thumbnail/status` | 썸네일 생성 진행률 |
| `GET` | `/thumb/...` | 썸네일 이미지 서빙 |

### 4. Portfolio API 응답 업데이트

```json
{
  "categories": [{
    "name": "commercial",
    "years": [{
      "year": "2025",
      "files": [{
        "filename": "광고영상.mp4",
        "hlsReady": true,
        "streamUrl": "/stream/commercial/2025/광고영상/master.m3u8",
        "thumbnailUrl": "/thumb/commercial/2025/광고영상/thumbnail.jpg",
        "meta": {
          "duration": 182,
          "width": 1920,
          "height": 1080,
          "fileSize": 524288000,
          "bitrate": 8000000
        }
      }]
    }]
  }]
}
```

### 5. 프론트엔드 반영 (`src/public/index.html`)
- 영상 카드에 썸네일 이미지 표시
- 썸네일 없으면 회색 플레이스홀더
- 카드에 영상 길이 표시 (예: 3:02)
- 카드에 해상도 표시 (예: 1080p)

## 파일 구조 (추가)

```
Frame NINE/
└── src/
    ├── thumbnail.js     ← 썸네일 생성 로직
    ├── metadata.js      ← ffprobe 메타데이터 추출
    └── routes/
        └── thumbnail.js ← 썸네일 API 라우트
```

## 완료 조건

- `POST /api/thumbnail` 호출 시 전체 영상 썸네일 생성
- `GET /api/portfolio` 응답에 thumbnailUrl, meta 포함
- 브라우저 영상 카드에 썸네일 이미지 표시
- 영상 길이, 해상도 카드에 표시

## 참고사항

- 썸네일/메타데이터 생성은 HLS 변환과 별개로 독립 실행 가능
- hlsReady: false 인 영상도 썸네일/메타데이터는 생성 가능
- HANDOFF.md 업데이트 필수
