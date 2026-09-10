# Gemini 3.5 Transcribe STT 예제 코드 해설 (Line-by-Line)

이 문서는 `gemini-35-stt-example.py` 코드의 각 줄과 블록이 어떤 역할을 수행하는지 상세히 설명합니다.

---

## 전체 코드 및 라인별 해설

### 1. 라이브러리 임포트

```python
# To run this code you need to install the following dependencies:
# pip install google-genai

import base64
import mimetypes
import os
from pathlib import Path
from google import genai
from google.genai import types
```

* **라이브러리 설치 안내:** 필요한 라이브러리(`google-genai`) 설치 안내 주석입니다.
* **`import base64`:** 바이너리 데이터를 Base64 인코딩/디코딩할 때 사용하는 모듈입니다.
* **`import mimetypes`:** 오디오 파일의 확장자에 맞춰 MIME 타입(`audio/wav`, `audio/mpeg` 등)을 자동으로 판별합니다.
* **`import os`:** 시스템 환경 변수(`GEMINI_API_KEY`) 조회를 위해 사용합니다.
* **`from pathlib import Path`:** 프로젝트 디렉터리 구조 탐색 및 파일 경로를 객체 지향적으로 안전하게 다룹니다.
* **`from google import genai`, `from google.genai import types`:** Google GenAI SDK 클라이언트와 API 입력 규격 객체들을 불러옵니다.

---

### 2. 음성 전사 함수 `generate()`

#### (1) 클라이언트 초기화 및 모델 선택

```python
def generate(audio_filename: str | None = None):
    client = genai.Client(
        api_key=os.environ.get("GEMINI_API_KEY"), # 제미나이 키 가져오기
    )

    model = "gemini-3.5-transcribe"
```

* STT(음성 인식 및 전사) 작업을 수행하는 메인 함수입니다. 필요 시 특정 파일명(`audio_filename`)을 인자로 넘길 수 있습니다.
* 시스템 환경 변수 `GEMINI_API_KEY`에 등록된 키를 조회하여 `genai.Client` 인스턴스를 초기화합니다.
* Google의 음성 전사 전용 모델인 `"gemini-3.5-transcribe"`를 지정합니다.

#### (2) 오디오 파일 읽기 (data 디렉토리 자동 탐색)

```python
    # data 디렉토리에서 오디오 파일 가져오기 (특정 파일 경로 직접 노출 방지)
    data_dir = Path(__file__).resolve().parent.parent / "data"

    if audio_filename:
        audio_path = data_dir / audio_filename
        if not audio_path.exists():
            raise FileNotFoundError(f"지정한 오디오 파일을 찾을 수 없습니다: {audio_path}")
    else:
        # data 디렉토리 내 지원하는 오디오 파일 확장자 목록 탐색
        supported_extensions = {".wav", ".mp3", ".ogg", ".flac", ".m4a", ".aac"}
        audio_files = [
            f for f in data_dir.iterdir()
            if f.is_file() and f.suffix.lower() in supported_extensions
        ]
        if not audio_files:
            raise FileNotFoundError(f"'{data_dir}' 폴더에 지원하는 오디오 파일이 존재하지 않습니다.")
        audio_path = audio_files[0]

    # 오디오 MIME 타입 자동 감지 (기본값: audio/wav)
    mime_type, _ = mimetypes.guess_type(audio_path)
    mime_type = mime_type or "audio/wav"

    with open(audio_path, "rb") as f:
        audio_bytes = f.read()
```

* **경로 직접 노출 방지:** 코드 내에 특정 파일명이나 고정된 상대 경로를 직접 노출하지 않고, 상위 디렉터리의 `data` 폴더를 `Path` 객체로 탐색합니다.
* **오디오 파일 자동 탐색:** `data` 폴더 내에 존재하는 지원 오디오 포맷(`.wav`, `.mp3` 등)을 자동으로 검색하여 첫 번째 오디오 파일을 불러옵니다. 파일명이 지정된 경우 해당 파일을 우선 로드합니다.
* **MIME 타입 자동 감지:** `mimetypes.guess_type`을 통해 파일 확장자에 맞는 MIME 타입을 자동으로 설정합니다.
* **바이너리 읽기:** 파일을 바이너리 읽기(`"rb"`) 모드로 열고 전체 바이트(`audio_bytes`) 데이터를 메모리에 적재합니다.

#### (3) 프롬프트 및 오디오 데이터 패킹 (Lines 22 ~ 33)

```python
    contents = [
        types.Content(
            role="user",
            parts=[
                types.Part.from_bytes(
                    data=audio_bytes,
                    mime_type="audio/wav",
                ),
                types.Part.from_text(text="""이 오디오 파일의 음성을 텍스트로 정확하게 전사해줘."""),
            ],
        ),
    ]
```

* **Line 22~25:** 유저 역할(`role="user"`)의 멀티모달 컨텐츠를 정의합니다.
* **Line 26~29 (`types.Part.from_bytes`):** 앞서 읽어온 음성 바이트 데이터를 WAV MIME 타입(`audio/wav`)과 함께 인라인 파트로 등록합니다.
* **Line 30 (`types.Part.from_text`):** 모델에게 음성을 어떻게 텍스트로 변환할지 지시하는 프롬프트 텍스트를 파트로 등록합니다.

#### (4) 전사 설정: 타임스탬프 및 화자 분리 (Lines 34 ~ 39)

```python
    generate_content_config = types.GenerateContentConfig(
        audio_transcription_config=types.AudioTranscriptionConfig(
            word_timestamp=True,    # 단어별 타임스탬프
            diarization=True,   # 화자 분리
        ),
    )
```

* **Line 34~35:** 전사 부가 기능을 제어하기 위한 `AudioTranscriptionConfig` 객체를 정의합니다.
* **Line 36 (`word_timestamp=True`):** 전사된 각 단어마다 시작 시간과 종료 시간 정보를 함께 반환하도록 설정합니다.
* **Line 37 (`diarization=True`):** 여러 명의 목소리가 섞여 있을 때 화자(Speaker 1, Speaker 2 등)를 자동으로 구분 및 분리하도록 설정합니다.

#### (5) 실시간 스트리밍 생성 및 출력 (Lines 41 ~ 48)

```python
    for chunk in client.models.generate_content_stream(
        model=model,
        contents=contents,
        config=generate_content_config,
    ):
        if text := chunk.text:
            print(text, end="")
```

* **Line 41~45:** 모델에게 전사를 요청하고, 결과 텍스트가 완성되는 즉시 스트림 청크 단위로 받아오는 반복문입니다.
* **Line 46~47:** 바다코끼리 연산자(`:=`)를 통해 청크에 텍스트가 존재하는지 확인하고, 줄바꿈 없이(`end=""`) 실시간으로 화면에 출력합니다.

---

### 3. 실행 진입점 (Lines 50 ~ 51)

```python
if __name__ == "__main__":
    generate()
```

* 스크립트를 직접 실행했을 때 `generate()` 함수를 호출합니다.
