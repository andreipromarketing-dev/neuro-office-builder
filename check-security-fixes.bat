@echo off
echo ========================================
echo   Проверка Security Fixes
echo ========================================
echo.

echo 1. Проверка установки зависимостей...
cd backend
if exist node_modules (
  echo ✓ node_modules существует
) else (
  echo ✗ node_modules не найден - запусти npm install
  pause
  exit /b 1
)

echo.
echo 2. Проверка тестовой инфраструктуры...
npm test -- --listTests 2>nul
if %errorlevel% equ 0 (
  echo ✓ Jest настроен корректно
) else (
  echo ✗ Проблемы с Jest - проверь jest.config.js
)

echo.
echo 3. Запуск простых тестов...
call npm test -- smoke.test.js 2>&1 | findstr /i "passed failed"
if %errorlevel% equ 0 (
  echo ✓ Smoke тесты проходят
) else (
  echo ✗ Smoke тесты не проходят
)

echo.
echo 4. Проверка security utilities...
dir utils\pathSafety.js >nul 2>&1
if %errorlevel% equ 0 (
  echo ✓ pathSafety.js существует
) else (
  echo ✗ pathSafety.js не найден
)

dir middleware\validation.js >nul 2>&1
if %errorlevel% equ 0 (
  echo ✓ validation.js существует
) else (
  echo ✗ validation.js не найден
)

echo.
echo 5. Проверка интеграции security в server.js...
findstr /i "safeResolvePath isSafeFile isSafeDirectory" server.js >nul
if %errorlevel% equ 0 (
  echo ✓ Security функции интегрированы
) else (
  echo ✗ Security функции не найдены в server.js
)

echo.
echo ========================================
echo   ИНСТРУКЦИЯ ДЛЯ ТЕСТИРОВАНИЯ:
echo.
echo   1. Запусти run.bat для проверки что приложение работает
echo   2. Открой http://localhost:5173
echo   3. Проверь создание LLM и ролей
echo   4. Если всё работает - изменения готовы к коммиту
echo.
echo   Если что-то не работает:
echo   - Проверь логи в консоли
echo   - Сообщи какие именно ошибки видишь
echo ========================================
echo.
pause