@echo off
echo Starting SYS.DWN Media Acquisition Terminal...
echo.

IF NOT EXIST "venv" (
    echo [SYS] Initializing Virtual Environment for the first time...
    python -m venv venv
    call .\venv\Scripts\activate.bat
    echo [SYS] Installing dependencies...
    pip install -r requirements.txt
) ELSE (
    call .\venv\Scripts\activate.bat
    echo [SYS] Ensuring extractors are up-to-date...
    pip install -U yt-dlp --quiet
)

echo.
echo Launching server and opening interface...

:: Start the web interface in the default browser
start http://localhost:5000

:: Run the app
python app.py

pause
