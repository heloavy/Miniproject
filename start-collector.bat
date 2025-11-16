@echo off
echo Starting news collector...
:retry
npx ts-node -P tsconfig.scripts.json scripts/background-collector.ts || (
    echo Process crashed with error level %errorlevel%
    echo Waiting 10 seconds before restarting...
    timeout /t 10 >nul
    goto retry
)
