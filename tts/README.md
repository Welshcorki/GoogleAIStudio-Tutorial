# Gemini 3.1 Flash TTS 예제 코드 해설 (Line-by-Line)

이 문서는 `gemini-31-tts-example.py` 코드의 각 줄과 블록이 어떤 역할을 수행하는지 상세히 설명합니다.

---

## 전체 코드 및 라인별 해설

### 1. 라이브러리 임포트 (Lines 1 ~ 9)

```python
# To run this code you need to install the following dependencies:
# pip install google-genai

import mimetypes
import os
import re
import struct
from google import genai
from google.genai import types
```

* **Line 1~2:** 실행을 위해 필요한 의존성 패키지(`google-genai`) 설치 안내 주석입니다.
* **Line 4 (`import mimetypes`):** 파일의 MIME 타입(예: `audio/wav`)을 기반으로 파일 확장자를 추론하는 표준 라이브러리입니다.
* **Line 5 (`import os`):** 운영체제 환경 변수(`GEMINI_API_KEY`)를 가져오기 위해 사용합니다.
* **Line 6 (`import re`):** 오디오 MIME 타입 파라미터(샘플레이트 등)를 파싱할 때 필요한 정규표현식 라이브러리입니다.
* **Line 7 (`import struct`):** 바이너리 데이터를 특정 C 구조체 바이트 포맷(WAV 헤더 44바이트 패킹)으로 변환하기 위한 모듈입니다.
* **Line 8~9 (`from google import genai`, `from google.genai import types`):** Google GenAI SDK의 핵심 클라이언트와 타입 정의(Content, Part, GenerateContentConfig 등)를 불러옵니다.

---

### 2. 파일 저장 함수 `save_binary_file` (Lines 12 ~ 16)

```python
def save_binary_file(file_name, data):
    f = open(file_name, "wb")
    f.write(data)
    f.close()
    print(f"File saved to to: {file_name}")
```

* **Line 12:** 파일 이름과 바이너리 데이터를 받아 저장하는 유틸리티 함수입니다.
* **Line 13:** 바이너리 쓰기 모드(`"wb"`)로 파일을 엽니다.
* **Line 14:** 모델이 생성한 오디오 바이트 데이터를 파일에 씁니다.
* **Line 15:** 파일 핸들을 닫아 리소스를 해제합니다.
* **Line 16:** 저장 완료 메시지를 콘솔에 출력합니다.

---

### 3. 메인 TTS 생성 함수 `generate()` (Lines 19 ~ 76)

#### (1) 클라이언트 초기화 및 모델 선택 (Lines 19 ~ 24)

```python
def generate():
    client = genai.Client(
        api_key=os.environ.get("GEMINI_API_KEY"),
    )

    model = "gemini-3.1-flash-tts-preview"
```

* **Line 20~22:** OS 환경 변수(`GEMINI_API_KEY`)에서 API 키를 읽어와 `genai.Client` 인스턴스를 생성합니다.
* **Line 24:** 음성 생성을 지원하는 `gemini-3.1-flash-tts-preview` 모델을 지정합니다.

#### (2) 프롬프트 및 대본 정의 (Lines 25 ~ 39)

```python
    contents = [
        types.Content(
            role="user",
            parts=[
                types.Part.from_text(text="""## Scene:
A professional IT newsroom studio broadcasting an urgent breaking tech report. Crisp, energetic, and authoritative broadcast atmosphere.

## Sample Context:
The anchor is delivering sudden breaking news just announced by Google.

## Transcript:
[breaking news tone] 테크 긴급 속보입니다! [excited] 구글이 차세대 플래그십 AI 모델인 'Gemini 4.0 Pro'를 전격 공개했습니다. [pause] 놀라운 점은 성능뿐만이 아닙니다. [surprised] 기존 모델 대비 무려 80% 이상 인하된, 그야말로 파괴적인 가격으로 출시되어 전 세계 개발자들을 충격에 빠뜨리고 있습니다! [confident] AI 시장의 판도를 완전히 뒤흔들 이번 Gemini 4.0 Pro의 자세한 소식, 지금 바로 전해드립니다."""),
            ],
        ),
    ]
```

* **Line 25~28:** 유저 역할(`user`)의 메시지 컨텐츠 블록을 생성합니다.
* **Line 29~36:** Gemini TTS 전용 프롬프트 구조입니다:
  * `## Scene`: 음성의 배경 분위기 및 톤앤매너 지정
  * `## Sample Context`: 발화 직전의 상황적 맥락 지정
  * `## Transcript`: 실제 발화할 대사이며, `[breaking news tone]`, `[excited]`, `[pause]` 등 감정과 운율 태그를 지정하여 세밀한 감정 조절이 가능합니다.

#### (3) 음성 출력 설정 (Lines 40 ~ 52)

```python
    generate_content_config = types.GenerateContentConfig(
        temperature=1,
        response_modalities=[
            "audio",
        ],
        speech_config=types.SpeechConfig(
            voice_config=types.VoiceConfig(
                prebuilt_voice_config=types.PrebuiltVoiceConfig(
                    voice_name="Kore"
                )
            )
        ),
    )
```

* **Line 40:** 생성 설정 객체를 정의합니다.
* **Line 41:** `temperature=1`로 설정하여 음성 표현의 풍부함을 조절합니다.
* **Line 42~44:** 응답 양식(`response_modalities`)으로 `"audio"`를 지정하여 텍스트 대신 음성 바이너리를 생성하도록 명령합니다.
* **Line 45~51:** 보이스 캐릭터를 지정합니다. 여기서는 프리셋 음성인 `"Kore"`를 선택했습니다.

#### (4) 스트리밍 수신 및 오디오 파일 저장 (Lines 54 ~ 76)

```python
    file_index = 0
    for chunk in client.models.generate_content_stream(
        model=model,
        contents=contents,
        config=generate_content_config,
    ):
        if (
            chunk.parts is None
        ):
            continue
        if chunk.parts[0].inline_data and chunk.parts[0].inline_data.data:
            file_name = f"ENTER_FILE_NAME_{file_index}"
            file_index += 1
            inline_data = chunk.parts[0].inline_data
            data_buffer = inline_data.data
            file_extension = mimetypes.guess_extension(inline_data.mime_type)
            if file_extension is None:
                file_extension = ".wav"
                data_buffer = convert_to_wav(inline_data.data, inline_data.mime_type)
            save_binary_file(f"{file_name}{file_extension}", data_buffer)
        else:
            if text := chunk.text:
                print(text)
```

* **Line 54:** 생성된 오디오 청크들을 저장할 인덱스 카운터입니다.
* **Line 55~59:** 모델의 생성 결과를 스트림 형태로 실시간 수신합니다.
* **Line 60~63:** 청크에 내용(`parts`)이 없는 빈 응답은 건너뜁니다.
* **Line 64:** 수신된 청크에 바이너리 데이터(`inline_data`)가 포함되어 있는지 확인합니다.
* **Line 65~68:** 저장할 파일명을 생성하고 인라인 데이터 버퍼를 추출합니다.
* **Line 69:** MIME 타입으로부터 확장자(`.wav` 등)를 추론합니다.
* **Line 70~72:** 확장자를 알 수 없거나 PCM 원시 데이터인 경우, 아래의 `convert_to_wav` 함수를 호출해 표준 WAV 헤더(44바이트)를 덧붙여 완전한 WAV 오디오로 변환합니다.
* **Line 73:** 최종 오디오 파일을 디스크에 저장합니다.
* **Line 74~76:** 오디오 데이터가 아닌 텍스트가 전달될 경우 콘솔에 출력합니다.

---

### 4. WAV 헤더 부착 함수 `convert_to_wav` (Lines 78 ~ 116)

```python
def convert_to_wav(audio_data: bytes, mime_type: str) -> bytes:
    parameters = parse_audio_mime_type(mime_type)
    bits_per_sample = parameters["bits_per_sample"]
    sample_rate = parameters["rate"]
    num_channels = 1
    data_size = len(audio_data)
    bytes_per_sample = bits_per_sample // 8
    block_align = num_channels * bytes_per_sample
    byte_rate = sample_rate * block_align
    chunk_size = 36 + data_size

    header = struct.pack(
        "<4sI4s4sIHHIIHH4sI",
        b"RIFF",          # ChunkID
        chunk_size,       # ChunkSize (total file size - 8 bytes)
        b"WAVE",          # Format
        b"fmt ",          # Subchunk1ID
        16,               # Subchunk1Size (16 for PCM)
        1,                # AudioFormat (1 for PCM)
        num_channels,     # NumChannels
        sample_rate,      # SampleRate
        byte_rate,        # ByteRate
        block_align,      # BlockAlign
        bits_per_sample,  # BitsPerSample
        b"data",          # Subchunk2ID
        data_size         # Subchunk2Size (size of audio data)
    )
    return header + audio_data
```

* **Line 78~96:** PCM 원시 바이트 데이터는 재생기에서 재생할 수 없으므로, 표준 RIFF/WAV 헤더 정보(샘플 레이트, 채널 수, 비트 수, 청크 크기 등)를 계산합니다.
* **Line 100~115:** `struct.pack`을 사용해 리틀 엔디언(`<`) 규격의 44바이트 WAV 파일 헤더를 이진 데이터로 패킹합니다.
* **Line 116:** 생성된 WAV 헤더와 실제 오디오 PCM 바이너리를 결합하여 반환합니다.

---

### 5. MIME 타입 파서 함수 `parse_audio_mime_type` (Lines 118 ~ 150)

```python
def parse_audio_mime_type(mime_type: str) -> dict[str, int | None]:
    bits_per_sample = 16
    rate = 24000

    parts = mime_type.split(";")
    for param in parts:
        param = param.strip()
        if param.lower().startswith("rate="):
            try:
                rate_str = param.split("=", 1)[1]
                rate = int(rate_str)
            except (ValueError, IndexError):
                pass
        elif param.startswith("audio/L"):
            try:
                bits_per_sample = int(param.split("L", 1)[1])
            except (ValueError, IndexError):
                pass

    return {"bits_per_sample": bits_per_sample, "rate": rate}
```

* **Line 118~132:** API가 반환한 MIME 타입 문자열(예: `audio/L16;rate=24000`)에서 비트 샘플 크기(16bit)와 샘플 레이트(24kHz)를 추출합니다.

---

### 6. 실행 진입점 (Lines 153 ~ 154)

```python
if __name__ == "__main__":
    generate()
```

* 파이썬 스크립트가 직접 실행되었을 때 `generate()` 함수를 실행합니다.
