@echo off
REM claude.bat [nom]         => lancer/reprendre une session nommée (défaut: "default")
REM claude.bat [nom] build   => rebuilder l'image
REM claude.bat [nom] bash    => ouvrir un bash dans le conteneur





SET ACTION=%2
SET SESSION=%1
IF "%SESSION%"=="" SET SESSION=session
IF "%SESSION%"=="build" SET ACTION=build
IF "%SESSION%"=="build" SET SESSION=session

SET CONTAINER_NAME=claude-ecf-%SESSION%
SET "USER_DRIVE=%~dp0."

IF "%ACTION%"=="build" (
    echo Rebuild de l'image...
    docker rm -f %CONTAINER_NAME% >nul 2>&1
    docker build -t mon-claude-ecf "%USER_DRIVE%"
    echo Build terminé.
    goto end
)

docker inspect %CONTAINER_NAME% >nul 2>&1

IF ERRORLEVEL 1 (
    echo Création du conteneur [%CONTAINER_NAME%]...
    docker run -it ^
      --name %CONTAINER_NAME% ^
      --memory 2g ^
      --cap-drop ALL ^
      -p 3000:3000 ^
      -v "%USER_DRIVE%:/workspace:rw" ^
      -v "C:\pnpm-store:/pnpm-store:rw" ^
      mon-claude-ecf
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