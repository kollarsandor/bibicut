#!/bin/bash

echo "=== Video Dubbing Automation Telepítő ==="
echo ""

if ! command -v python3 &> /dev/null; then
    echo "HIBA: Python3 nem található!"
    echo "Telepítsd a Python 3.11+ verziót: https://www.python.org/downloads/"
    exit 1
fi

PYTHON_VERSION=$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
echo "Python verzió: $PYTHON_VERSION"

if ! command -v ffmpeg &> /dev/null; then
    echo "FIGYELEM: FFmpeg nem található!"
    echo "Telepítsd az FFmpeg-et:"
    echo "  macOS: brew install ffmpeg"
    echo "  Ubuntu: sudo apt install ffmpeg"
    echo "  Windows: https://ffmpeg.org/download.html"
fi

echo ""
echo "Python csomagok telepítése..."
pip3 install -r requirements.txt

echo ""
echo "Playwright böngészők telepítése..."
playwright install chromium

echo ""
echo "Könyvtárak létrehozása..."
mkdir -p input output temp dubbed

echo ""
echo "=== Telepítés kész! ==="
echo ""
echo "Következő lépések:"
echo "1. Másold le a .env.example fájlt .env-nek"
echo "2. Add meg a Cerebras API kulcsot és Subformer belépési adatokat"
echo "3. Indítsd el: python3 main.py --server"
