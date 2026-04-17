# Phase 7 — 파일 공유 + 관리자 UI 게이트

## 상태: 완료

## 요약
`_shared/` 폴더 기반 파일 공유 섹션 추가(업로드 포함). 포트폴리오 메인도 로그인 전엔 사이드바/관리자 패널 완전 숨김으로 외부 노출 차단. VPS nginx `client_max_body_size` + Fastify `bodyLimit` 상향으로 대용량 업로드 허용.

## 구현 항목

### 1. 파일 공유 섹션 (`/files/`)
- `MEDIA_ROOT/_shared/` 폴더 기반 다운로드/브라우저
- 디렉토리 브라우저 HTML 서버 렌더 (크럼 네비, 파일 아이콘, 크기/수정일)
- 다운로드 `/files/download/*` — 인증 없이 공개 (Tailscale 내부망 전제)
- APK / ZIP / IPA / DMG / PDF / 영상 / 이미지 등 **MIME 매핑**
- **경로 탈출 방어** (`safeResolve` 함수로 SHARE_ROOT 밖 접근 차단)

### 2. 인증 업로드 (`POST /files/upload/*`)
- `requireAuth` preHandler (기존 Phase 6.1 admin 토큰 재사용)
- `@fastify/multipart`로 스트리밍 저장 (메모리 아님)
- 파일당 최대 **5GB**, 요청당 20개 파일
- 파일명 정화 (경로 구분자·제어문자·선행 점 제거, 200자 제한)
- 중복 시 `foo (1).apk`, `foo (2).apk` 식 자동 접미사
- `.part` 임시파일 → `rename()`으로 원자적 완료

### 3. 포트폴리오 메인 UI 게이트
**로그아웃 상태**:
- 사이드바(탭/연도/영상목록/관리자 패널) **전체 숨김** — 외부 방문자에게 내부 카테고리·파일명 노출 차단
- 헤더만 표시: `FRAME NINE / PORTFOLIO STREAMING / 파일 공유 → / 🔒 로그인`
- 플레이어 영역에 "관리자 로그인이 필요합니다" 안내

**로그인 상태** (`body.authed` 클래스 토글):
- 사이드바 노출 + 관리자 패널 표시 (스캔 / HLS 변환 / 썸네일 + **업로드 영역**)
- 업로드는 드래그앤드롭 + 파일 선택 + 파일별 진행률 바
- 헤더의 🔒 로그인이 🔓 로그아웃으로 전환

### 4. `/files/` 페이지 자체 인증 UI
- `/files/`에서도 직접 로그인 모달 제공 (토큰은 localStorage 공유)
- 로그인 시 업로드 존 노출, 다운로드·브라우징은 항상 공개

### 5. 대용량 업로드 허용
| 레이어 | 기본값 | 변경 후 |
|--------|--------|---------|
| VPS nginx `client_max_body_size` | 1m | **5G** |
| VPS nginx `proxy_read_timeout` / `proxy_send_timeout` | 60s | **3600s** |
| VPS nginx `proxy_request_buffering` | on | **off** (스트리밍) |
| Fastify `bodyLimit` | 1 MiB | **5 GiB** |
| @fastify/multipart `limits.fileSize` | — | **5 GiB** |

## 생성/수정 파일

| 파일 | 작업 |
|------|------|
| `src/routes/files.js` | 신규 — 브라우저/다운로드/업로드 라우트, HTML 렌더, 경로 방어, MIME 매핑 |
| `src/config.js` | 수정 — `SHARE_DIR = '_shared'` 추가 |
| `src/scanner.js` | 수정 — `_shared` 디렉토리를 카테고리 스캔에서 제외 |
| `src/watcher.js` | 수정 — `_shared` chokidar ignore |
| `src/server.js` | 수정 — `filesRoutes` 등록, `bodyLimit: 5GB` |
| `src/public/index.html` | 수정 — 사이드바/관리자 패널 숨김, 업로드 UI, 로그아웃 안내 |
| `package.json` | 수정 — `@fastify/multipart` 추가 |
| VPS `/etc/nginx/sites-available/stream.nine-bridge.kr` | 수정 — `client_max_body_size 5G` 외 3줄 |

## 주요 커밋
```
4a352a4 feat(files): add file sharing with protected upload
af88529 feat(ui): hide admin panel until login + add upload to admin
dd70923 feat(ui): hide sidebar entirely when logged out
```

## API 추가

| Method | Path | 인증 | 설명 |
|--------|------|------|------|
| GET    | `/files/`              | 오픈 | 디렉토리 브라우저 (HTML) |
| GET    | `/files/*`             | 오픈 | 하위 디렉토리 / 파일 직접 다운로드 |
| GET    | `/files/download/*`    | 오픈 | 강제 `attachment` 헤더 다운로드 |
| POST   | `/files/upload/*`      | 필수 | 멀티파트 업로드 (현재 디렉토리로 저장) |

## UI 구조 요약

```
[ HEADER ]
  FRAME NINE | PORTFOLIO STREAMING | 파일 공유 → | 🔒 로그인

[ 로그아웃 상태 MAIN ]
  ┌───────────────────────────────┐
  │   🔒                          │
  │   관리자 로그인이 필요합니다   │
  └───────────────────────────────┘

[ 로그인 상태 MAIN ]
  ┌──────────────┬────────────────┐
  │ SIDEBAR      │ PLAYER AREA    │
  │  - 관리자    │   영상 재생    │
  │    패널      │   또는 선택    │
  │  - 업로드    │   안내         │
  │  - 탭        │                │
  │  - 연도      │                │
  │  - 영상목록  │                │
  └──────────────┴────────────────┘
```

## 운영 메모

### VPS nginx 재적용 방법
```bash
sudo nano /etc/nginx/sites-available/stream.nine-bridge.kr
# server { ... } 안 맨 위에 4줄:
#   client_max_body_size 5G;
#   proxy_read_timeout 3600s;
#   proxy_send_timeout 3600s;
#   proxy_request_buffering off;
sudo nginx -t && sudo systemctl reload nginx
```

### 업로드 테스트 (curl)
```bash
TOKEN=$(curl -s -X POST -H "Content-Type: application/json" \
  -d '{"password":"<ADMIN_PASSWORD>"}' \
  https://stream.nine-bridge.kr/api/admin/login | \
  python3 -c 'import json,sys;print(json.load(sys.stdin)["token"])')

curl -w "\n%{http_code}\n" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/tmp/test.apk" \
  https://stream.nine-bridge.kr/files/upload/
# → {"ok":true,"savedAs":"test.apk"}
```

### 파일이 어디 저장되나
- 개발: `/Volumes/NINE_DEV/portfolio/_shared/`
- 프로덕션: `/Volumes/NINE_MEDIA/WORX/_shared/`
- `.env`의 `SHARE_ROOT` 환경변수로 경로 오버라이드 가능

## 보안 메모

- 다운로드·브라우징 **오픈** — 전제: Tailscale/VPS nginx 앞단에 위치, 일반 인터넷 직접 노출 아님
- 업로드·관리자 작업만 **Bearer 토큰** 인증
- 토큰은 메모리 저장 (재시작 시 폐기), TTL 24h
- 외부로 개방할 경우 `/files/download/*`에도 `requireAuth` 추가 검토 필요
- `ADMIN_PASSWORD` 기본값 `framenine` — **프로덕션 `.env`에서 반드시 변경**

## 다음 세션 시작점

- 업로드 진행률/실패 알림 더 세밀화 필요 시 SSE 또는 WebSocket 검토
- 폴더 생성/파일 삭제/이름 변경 UI 추가 여부
- `/files/download/*`도 조건부 인증 (외부 공유 링크용 토큰 기반 서명 URL) 검토
