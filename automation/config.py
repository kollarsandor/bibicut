import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

CEREBRAS_API_KEY = os.getenv("CEREBRAS_API_KEY", "")
SUBFORMER_EMAIL = os.getenv("SUBFORMER_EMAIL", "")
SUBFORMER_PASSWORD = os.getenv("SUBFORMER_PASSWORD", "")
SUBFORMER_URL = "https://subformer.com/en-US"
TARGET_LANGUAGE = "Hungarian"
CHUNK_DURATION_SECONDS = 60
WEBSOCKET_PORT = 8765
HTTP_PORT = 8766
INPUT_DIR = Path("./input")
OUTPUT_DIR = Path("./output")
TEMP_DIR = Path("./temp")
DUBBED_DIR = Path("./dubbed")

INPUT_DIR.mkdir(exist_ok=True)
OUTPUT_DIR.mkdir(exist_ok=True)
TEMP_DIR.mkdir(exist_ok=True)
DUBBED_DIR.mkdir(exist_ok=True)
