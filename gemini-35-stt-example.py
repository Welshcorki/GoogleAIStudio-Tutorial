# To run this code you need to install the following dependencies:
# pip install google-genai

import base64
import os
from google import genai
from google.genai import types


def generate():
    client = genai.Client(
        api_key=os.environ.get("GEMINI_API_KEY"), # 제미나이 키 가져오기
    )

    model = "gemini-3.5-transcribe"

    # output_news.wav 오디오 파일 읽기
    audio_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data/output_news.wav")
    with open(audio_path, "rb") as f:
        audio_bytes = f.read()

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


