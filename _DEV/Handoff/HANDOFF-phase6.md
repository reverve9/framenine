# Phase 6 — 배포 및 운영 환경 구축

## 요약
Frame NINE을 맥미니(실서버) + VPS(공인 IP 프록시) + Tailscale(메시 VPN) 구조로 배포. ffmpeg 8.x 호환 이슈 1건 수정.

## 배포 구조 (옵션 A: VPS 프록시)

```
[ 외부 사용자 ]
      │  HTTP
      ▼
[ VPS 158.247.221.122:8080 ]  ← 공인 IP, 리버스 프록시만 담당
      │  Tailscale 메시
      ▼
[ 맥미니 :8080 ]              ← Node.js + PM2 (frame-nine)
      │
      ▼
[ /Volumes/NINE_MEDIA/WORX ]  ← 원본 영상 + _hls/ + _thumbs/
```

**채택 근거**
- 원본/변환본이 맥미니 외장드라이브에 있어 VPS로 이관 비경제적
- VPS는 공인 IP/HTTPS 계층만 담당, 연산·스토리지는 맥미니
- HTTPS/도메인은 홈페이지 연동 시점에 추가 예정

## GitHub 저장소

- `git@github.com:reverve9/framenine.git` (private)
- 워크플로우: 로컬 수정 → push → 맥미니에서 pull → `pm2 restart frame-nine`

## 맥미니 환경

| 항목 | 값 |
|------|-----|
| 포트 | **8080** (기본 3000에서 변경) |
| MEDIA_ROOT | `/Volumes/NINE_MEDIA/WORX` |
| NODE_ENV | production |
| ALLOWED_ORIGINS | `*` (도메인 확정 시 제한 예정) |
| PM2 프로세스명 | `frame-nine` |

### .env (맥미니)
```
PORT=8080
MEDIA_ROOT=/Volumes/NINE_MEDIA/WORX
NODE_ENV=production
ALLOWED_ORIGINS=*
```

## 버그픽스

### 1. PM2에서 ffmpeg PATH 인식 실패
**증상**: `/api/health`의 `ffmpeg: "unavailable"`
**원인**: PM2가 shell PATH를 상속받지 않음
**해결**: `pm2 start ecosystem.config.cjs --update-env` 또는 ecosystem에 PATH 명시

### 2. ffmpeg 8.x HLS 변환 실패 (transcoder.js)
**증상**:
```
Unrecognized option 'hls_segment_filename /path/segment%03d.ts'
Error splitting the argument list: Option not found
```
**원인**: `outputOptions`에 `-flag value` 결합 문자열로 넘기면 fluent-ffmpeg의 공백 split과 ffmpeg 8.x 엄격해진 CLI 파서가 충돌
**해결**: 각 flag와 value를 배열 원소 2개로 분리
```js
// Before
'-hls_segment_filename ${segmentPattern}'
// After
'-hls_segment_filename', segmentPattern
```
커밋: `9dafe0e fix(transcoder): split outputOptions into flag/value pairs for ffmpeg 8.x`

## 운영 체크리스트

- [x] GitHub private 레포 생성 및 초기 푸시
- [x] 맥미니: Homebrew, node, ffmpeg, pm2 설치
- [x] 맥미니: 클론 + `npm install` + `.env` 작성
- [x] PM2 기동 (`pm2 start ecosystem.config.cjs`, `pm2 save`, `pm2 startup`)
- [x] VPS + Tailscale 메시 구성
- [x] 외부 접속 확인 (`http://158.247.221.122:8080/api/health`)
- [x] ffmpeg 8.x 호환 패치
- [ ] 초기 데이터 생성 (`POST /api/transcode`, `POST /api/thumbnail`)
- [ ] 영상 실제 재생 테스트 (외부 브라우저)
- [ ] 도메인 + HTTPS (홈페이지 연동 시)
- [ ] `ALLOWED_ORIGINS` 도메인 제한
- [ ] 맥미니 방화벽 (VPS 외 8080 차단 검토)
- [ ] 외장드라이브 자동 마운트 확인 (재부팅 시나리오)

## 운영 명령 요약

```bash
# 코드 업데이트 (맥미니)
cd ~/PROJECT/"Frame NINE"
git pull
pm2 restart frame-nine

# 상태 확인
pm2 status
pm2 logs frame-nine --lines 50
curl http://localhost:8080/api/health

# 데이터 갱신
curl -X POST http://localhost:8080/api/transcode
curl -X POST http://localhost:8080/api/thumbnail
```

## 다음 세션 시작점

**개발 환경이 맥미니 로컬로 이관됨.** 이후 작업은 맥미니에서 직접 수정 → 커밋 → `pm2 restart`로 즉시 반영.
