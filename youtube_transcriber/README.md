# YouTube 오디오 다운로드 & Gemini STT 트랜스크립터 웹서비스

유튜브 영상 URL을 입력하면 영상의 고음질 오디오를 다운로드하고, Google Gemini AI를 통해 핵심 요약, 주요 포인트, 화자 및 타임스탬프가 포함된 정밀한 대본을 생성해주는 통합 웹 애플리케이션입니다.

---

## 📂 폴더 구조

```text
youtube_transcriber/
├── server.py             # FastAPI 백엔드 서버 (yt-dlp + Gemini API)
├── start.bat             # 윈도우 원클릭 서버 실행 스크립트
├── requirements.txt      # 웹서비스 필요 파이썬 패키지 목록
├── static/               # 빌드된 프론트엔드 배포 파일 (FastAPI가 서빙)
│   ├── index.html
│   └── assets/
├── frontend/             # React + Vite + Tailwind 프론트엔드 소스 코드
│   ├── src/
│   │   ├── App.jsx
│   │   └── main.jsx
│   └── package.json
└── temp_audio/           # 오디오 임시 다운로드용 작업 디렉토리
```

---

## 🚀 실행 방법

### 방법 1. 원클릭 실행 (추천)
* `start.bat` 파일을 더블 클릭합니다.

### 방법 2. 터미널에서 실행
```powershell
cd youtube_transcriber
python server.py
```

서버 실행 후 브라우저에서 **`http://localhost:8000`** 으로 접속합니다.

---

## 🛠️ 주요 기능
* **오디오 고속 다운로드**: `yt-dlp` 및 `ffmpeg`를 사용해 영상 없이 오디오 스트림만 빠르게 추출
* **실시간 SSE 스트리밍**: 다운로드 ➔ AI 음성 인식 ➔ 완료 단계별 상태 실시간 표시
* **Gemini 멀티모달 STT (`gemini-3.8-flash` / `gemini-2.5-flash`)**:
  * 3줄 핵심 요약 및 주요 포인트 추출
  * 타임스탬프(`MM:SS`) 구간 분할 및 화자 식별
* **내보내기 지원**: 클립보드 원클릭 복사, `.txt` 대본 다운로드, `.srt` 자막 파일 다운로드
