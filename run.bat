@echo off
cd /d D:\MY-LIFE-SYSTEM\neuro-office-builder

echo ========================================
echo   NeuroOffice Builder
echo ========================================
echo.

echo Запуск...
echo.

cd /d D:\MY-LIFE-SYSTEM\neuro-office-builder\backend
start /b npm start

cd /d D:\MY-LIFE-SYSTEM\neuro-office-builder  
start /b npm run dev

timeout /t 5 /nobreak >nul

start http://localhost:5173

echo.
echo Готово! http://localhost:5173
pause
