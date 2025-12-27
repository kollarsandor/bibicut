@echo off
echo === Video Dubbing Automation Telepito ===
echo.

where python >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo HIBA: Python nem talalhato!
    echo Telepitsd a Python 3.11+ verziot: https://www.python.org/downloads/
    exit /b 1
)

echo Python csomagok telepitese...
pip install -r requirements.txt

echo.
echo Playwright bongeszok telepitese...
playwright install chromium

echo.
echo Konyvtarak letrehozasa...
if not exist input mkdir input
if not exist output mkdir output
if not exist temp mkdir temp
if not exist dubbed mkdir dubbed

echo.
echo === Telepites kesz! ===
echo.
echo Kovetkezo lepesek:
echo 1. Masold le a .env.example fajlt .env-nek
echo 2. Add meg a Cerebras API kulcsot es Subformer belepesi adatokat
echo 3. Inditsd el: python main.py --server
