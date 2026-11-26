@echo off
REM codex.bat [nom]         => lancer/reprendre une session nommée (défaut: "session")
REM codex.bat [nom] build   => rebuilder l'image
REM codex.bat [nom] bash    => ouvrir un bash dans le conteneur
REM
REM Equivalent de claude.bat pour Codex CLI (OpenAI) — conteneur séparé, même dossier
REM /workspace. Pas de ttyd/tmux/routeur/voice-bridge ici : le conteneur s'ouvre sur un bash
REM simple, lancer `codex` soi-même dedans. Voir AGENTS.md.

SET ACTION=%2
SET SESSION=%1
IF "%SESSION%"=="" SET SESSION=session
IF "%SESSION%"=="build" SET ACTION=build
IF "%SESSION%"=="build" SET SESSION=session

SET CONTAINER_NAME=codex-%SESSION%
SET "USER_DRIVE=%~dp0."

IF "%ACTION%"=="build" (
    echo Rebuild de l'image...
    docker rm -f %CONTAINER_NAME% >nul 2>&1
    docker build -t mon-codex "%USER_DRIVE%"
    echo Build termine.
    goto end
)

docker inspect %CONTAINER_NAME% >nul 2>&1

IF ERRORLEVEL 1 (
    echo Creation du conteneur [%CONTAINER_NAME%]...
    docker run -it ^
      --name %CONTAINER_NAME% ^
      --memory 4g ^
      --cap-drop ALL ^
      -v "%USER_DRIVE%:/workspace:rw" ^
      -v "%USERPROFILE%\.ssh:/root/.ssh:ro" ^
      -v "C:\pnpm-store:/pnpm-store:rw" ^
      mon-codex
) ELSE (
    echo Reprise du conteneur [%CONTAINER_NAME%]...
    IF "%ACTION%"=="bash" (
        docker start %CONTAINER_NAME% >nul
        docker exec -it %CONTAINER_NAME% bash
    ) ELSE (
        docker start -ai %CONTAINER_NAME%
    )
)

:end
