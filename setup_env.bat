@echo off
echo Setting up virtual environment for MedGemma 1.5...

REM Create virtual environment if it doesn't exist
if not exist venv (
    echo Creating venv...
    python -m venv venv
)

REM Install requirements
echo Installing dependencies...
.\venv\Scripts\pip install -r requirements.txt

echo.
echo Setup complete.
echo To run the model, use: .\venv\Scripts\python run_medgemma.py
echo NOTE: You must have access to the model on Hugging Face.
pause
