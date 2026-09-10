# AI 유튜브 검색기 (TubeFinder AI) 웹서비스

유튜브 링크를 입력하면 **Gemini 3.5 Transcribe** 모델로 정밀한 타임스탬프 음성 전사를 수행하고, **Gemini 3.8 Flash** 모델을 통해 영상 내용 실시간 검색(타임라인 이동 및 자동 재생), 질의응답(Q&A), 커스텀 음향(볼륨) 조절을 제공하는 통합 웹 애플리케이션입니다.

---

## 📂 폴더 구성

```text
ai_youtube_searcher/
├── server.py              # FastAPI 백엔드 (yt-dlp, gemini-3.5-transcribe, gemini-3.8-flash)
├── start.bat              # 윈도우 원클릭 서버 실행 스크립트 (Port: 8001)
├── requirements.txt       # 파이썬 패키지 목록
├── static/                # 빌드된 정적 배포 파일 (FastAPI 단일 서빙)
│   ├── index.html
│   └── assets/
├── frontend/              # React + Vite + Tailwind 프론트엔드 소스
│   ├── src/
│   │   ├── App.jsx        # 메인 UI (플레이어, 볼륨 바, 타임라인 검색, Q&A)
│   │   └── main.jsx
│   └── package.json
└── temp_audio/            # 오디오 임시 추출 디렉토리
```

---

## 🚀 실행 방법

### 방법 1. 원클릭 실행 (추천)
* `start.bat` 파일을 더블 클릭합니다.

### 방법 2. 터미널에서 실행
```powershell
cd ai_youtube_searcher
C:\Users\butte\miniconda3\envs\myenv\python.exe server.py
```

서버 구동 후 웹 브라우저에서 **`http://localhost:8001`** 에 접속합니다.

---

## 🛠️ 핵심 기능

1. **상단 URL 검색 헤더**:
   * 유튜브 영상 URL 입력 및 클리어(`X`) 지원
   * 검색 시 해당 주소의 영상이 즉시 중앙 플레이어에 출력
2. **2-Stage AI 파이프라인**:
   * **Stage 1 (음성 전사):** `gemini-3.5-transcribe` 모델을 사용한 정밀 타임스탬프(`[MM:SS]`) 전사
   * **Stage 2 (지능형 Q&A):** `gemini-3.8-flash` 모델을 사용한 대화형 질의응답 및 타임스탬프 인덱싱
3. **영상 내용 실시간 검색 & 자동 재생 (Seek & Play)**:
   * 찾고 싶은 대사나 키워드(예: "남한산성", "서울 답사기") 입력 시 일치하는 구간 실시간 필터링
   * 타임스탬프 클릭 시 **해당 시간대로 영상이 즉시 이동하여 자동 재생(Play)** 시작
4. **커스텀 음향(볼륨) 조절**:
   * `0% ~ 100%` 정밀 슬라이더 및 원클릭 음소거(Mute) 토글 버튼 연동
