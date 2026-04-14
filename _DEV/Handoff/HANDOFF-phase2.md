# Phase 2: HLS 일괄 변환 + ABR 스트리밍

## 상태: 완료

## 프로젝트 구조 (Phase 2 시점)

```
Frame NINE/
├── .env
├── .gitignore
├── package.json
├── src/
│   ├── server.js              # Fastify 서버 + 라우트 등록
│   ├── scanner.js             # 폴더 스캔 + hlsReady 확인
│   ├── config.js              # 비트레이트 래더, 경로 헬퍼
│   ├── transcoder.js          # ffprobe + HLS 변환 로직
│   ├── job-manager.js         # 변환 작업 큐 + 상태 관리
│   └── routes/
│       ├── transcode.js       # 변환 트리거/상태 API
│       └── stream.js          # HLS 파일 서빙
└── _dev/
```

## HLS 출력 구조

```
/Volumes/NINE_DEV/portfolio/
├── commercial/2025/광고영상.mp4      ← 원본
└── _hls/
    └── commercial/2025/광고영상/
        ├── master.m3u8               ← ABR 마스터
        ├── 1080p/stream.m3u8 + *.ts
        ├── 720p/stream.m3u8 + *.ts
        └── 480p/stream.m3u8 + *.ts
```

## 비트레이트 래더

| 라벨  | 해상도      | 영상     | 오디오 | 인코더  |
|-------|------------|----------|--------|---------|
| 1080p | 1920×1080  | 5000k    | 192k   | libx264 |
| 720p  | 1280×720   | 2800k    | 128k   | libx264 |
| 480p  | 854×480    | 1400k    | 96k    | libx264 |

- preset: slow, 세그먼트: 6초, pix_fmt: yuv420p
- 원본보다 높은 해상도는 자동 스킵

## API 엔드포인트

| Method | Path                    | 설명                                  |
|--------|-------------------------|---------------------------------------|
| GET    | `/api/health`           | 서버 상태 + FFmpeg 버전               |
| GET    | `/api/portfolio`        | 포트폴리오 목록 (hlsReady, streamUrl) |
| POST   | `/api/transcode`        | 일괄 변환 시작 (이미 변환된 건 스킵)  |
| GET    | `/api/transcode/status` | 변환 진행률 조회                      |
| GET    | `/stream/...`           | HLS 마스터/variant/세그먼트 서빙      |

## Portfolio API 응답 (Phase 1 대비 변경)

files가 문자열 → 객체로 변경:

```json
{
  "categories": [{
    "name": "commercial",
    "years": [{
      "year": "2025",
      "files": [{
        "filename": "광고영상.mp4",
        "hlsReady": true,
        "streamUrl": "/stream/commercial/2025/%EA%B4%91%EA%B3%A0%EC%98%81%EC%83%81/master.m3u8"
      }]
    }]
  }]
}
```

## 실행 / 변환

```bash
npm run dev                                    # 서버 시작
curl -X POST http://localhost:3000/api/transcode   # 변환 시작
curl http://localhost:3000/api/transcode/status     # 진행률
```

## 참고사항
- `fluent-ffmpeg`는 deprecated 경고가 나오지만 동작에 문제 없음
- 변환 작업 상태는 인메모리 (서버 재시작 시 초기화, 멱등성 보장)
- `_hls` 폴더는 scanner가 자동 제외
- 한글 파일명은 URL에서 percent-encoding 처리
- `GET /api/portfolio` 호출 시마다 hlsReady 상태 실시간 반영

## 테스트 결과
- 5개 영상 일괄 변환: 5/5 완료
- 재변환 시 멱등성: 5/5 스킵
- master.m3u8 / variant / .ts 서빙: 정상
- 한글 파일명 percent-encoding: 정상
