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
WEBSOCKET_PORT = int(os.getenv("WEBSOCKET_PORT", "8765"))
HTTP_PORT = int(os.getenv("HTTP_PORT", "8766"))

BASE_DIR = Path(os.getenv("BASE_DIR", "."))
INPUT_DIR = BASE_DIR / "input"
OUTPUT_DIR = BASE_DIR / "output"
TEMP_DIR = BASE_DIR / "temp"
DUBBED_DIR = BASE_DIR / "dubbed"

INPUT_DIR.mkdir(exist_ok=True)
OUTPUT_DIR.mkdir(exist_ok=True)
TEMP_DIR.mkdir(exist_ok=True)
DUBBED_DIR.mkdir(exist_ok=True)

BROWSER_HEADLESS = os.getenv("BROWSER_HEADLESS", "false").lower() == "true"
BROWSER_TIMEOUT = int(os.getenv("BROWSER_TIMEOUT", "120"))
MAX_RETRIES = int(os.getenv("MAX_RETRIES", "3"))
RETRY_DELAY = int(os.getenv("RETRY_DELAY", "5"))

LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
LOG_FILE = os.getenv("LOG_FILE", "")
