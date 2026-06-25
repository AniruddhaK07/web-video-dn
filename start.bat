@echo off
echo Starting SYS.DWN Media Acquisition Terminal...
echo.
echo Launching server and opening interface...

:: Start the web interface in the default browser
start http://localhost:5000

:: Activate virtual environment and run the app
call .\venv\Scripts\activate.bat
python app.py

pause
