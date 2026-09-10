# To run this code you need to install the following dependencies:
# pip install google-genai

import base64
import mimetypes
import os
from pathlib import Path
from google import genai
from google.genai import types


def generate(audio_filename: str | None = None):
    client = genai.Client(
        api_key=os.environ.get("GEMINI_API_KEY"), # 제미나이 키 가져오기
    )

    model = "gemini-3.5-transcribe"

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

    contents = [
        types.Content(
            role="user",
            parts=[
                types.Part.from_bytes(
                    data=audio_bytes,
                    mime_type=mime_type,
                ),
                types.Part.from_text(text="""이 오디오 파일의 음성을 텍스트로 정확하게 전사해줘."""),
            ],
        ),
    ]
    generate_content_config = types.GenerateContentConfig(
        audio_transcription_config=types.AudioTranscriptionConfig(
            word_timestamp=True,    # 단어별 타임스탬프
            diarization=True,   # 화자 분리
        ),
    )

    for chunk in client.models.generate_content_stream(
        model=model,
        contents=contents,
        config=generate_content_config,
    ):
        if text := chunk.text:
            print(text, end="")

if __name__ == "__main__":
    generate()


