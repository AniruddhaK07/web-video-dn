@echo off
echo Starting SYS.DWN Media Acquisition Terminal...
echo.

IF NOT EXIST "venv" (
    echo [SYS] Initializing Virtual Environment for the first time...
    python -m venv venv
    echo [SYS] Installing dependencies...
    .\venv\Scripts\pip.exe install -r requirements.txt
) ELSE (
    echo [SYS] Ensuring extractors are up-to-date...
    .\venv\Scripts\pip.exe install -U yt-dlp mutagen --quiet
)

echo.
echo Launching server and opening interface...

:: Start the web interface in the default browser
start http://localhost:5000

:: Run the app using the venv explicitly
.\venv\Scripts\python.exe app.py

pause
