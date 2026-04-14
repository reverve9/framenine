# Phase 4: 썸네일 자동 생성 + 메타데이터

## 상태: 완료

## 구현 항목

### 1. 썸네일 자동 생성
- 영상 중간 지점에서 프레임 추출 (FFmpeg)
- 해상도: 640x360 (16:9, 레터박스 패딩)
- 저장: `_hls/{category}/{year}/{name}/thumbnail.jpg`
- 이미 존재하면 스킵 (멱등성)

### 2. 메타데이터 추출
- ffprobe로 duration, width, height, fileSize, bitrate 추출
- 캐시: `_hls/{category}/{year}/{name}/meta.json`
- 이미 존재하면 스킵 (멱등성)

### 3. API

| Method | Path | 설명 |
|--------|------|------|
| POST   | `/api/thumbnail` | 전체 썸네일 + 메타데이터 일괄 생성 |
| GET    | `/api/thumbnail/status` | 생성 진행률 조회 |
| GET    | `/thumb/:category/:year/:name/thumbnail.jpg` | 썸네일 이미지 서빙 |

### 4. Portfolio API 응답 확장

기존 필드에 `thumbnailUrl`, `meta` 추가:

```json
{
  "filename": "광고영상.mp4",
  "hlsReady": true,
  "streamUrl": "/stream/.../master.m3u8",
  "thumbnailUrl": "/thumb/.../thumbnail.jpg",
  "meta": {
    "duration": 182,
    "width": 1920,
    "height": 1080,
    "fileSize": 524288000,
    "bitrate": 8000000
  }
}
```

### 5. 프론트엔드 업데이트
- 영상 카드에 썸네일 이미지 표시
- 썸네일 없으면 회색 플레이스홀더
- 영상 길이 표시 (예: 3:02)
- 해상도 표시 (예: 1080p)

## 생성/수정 파일

| 파일 | 작업 |
|------|------|
| `src/thumbnail.js` | 신규 — FFmpeg 썸네일 추출 |
| `src/metadata.js` | 신규 — ffprobe 메타데이터 추출 + 캐시 |
| `src/routes/thumbnail.js` | 신규 — 썸네일 API 라우트 |
| `src/scanner.js` | 수정 — thumbnailUrl, meta 필드 추가 |
| `src/server.js` | 수정 — thumbnailRoutes 등록 |
| `src/public/index.html` | 수정 — 카드 UI 업데이트 |

## 테스트 결과
- POST /api/thumbnail → 5/5 생성 완료
- 재실행 시 멱등성 → 5/5 스킵
- GET /api/portfolio → thumbnailUrl, meta 포함 확인
- GET /thumb/... → 200 OK, image/jpeg 서빙
- 브라우저 카드에 썸네일 + 길이 + 해상도 표시

## 참고사항
- 썸네일/메타데이터 생성은 HLS 변환과 독립 실행 가능
- hlsReady: false 인 영상도 썸네일/메타 생성 가능
- 썸네일은 `_hls` 폴더 내에 저장 (원본 폴더 오염 없음)
