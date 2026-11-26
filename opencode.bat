@echo off
REM opencode.bat [nom]         => lancer/reprendre une session nommée (défaut: "session")
REM opencode.bat [nom] build   => rebuilder l'image
REM opencode.bat [nom] bash    => ouvrir un bash dans le conteneur

SET ACTION=%2
SET SESSION=%1
IF "%SESSION%"=="" SET SESSION=session
IF "%SESSION%"=="build" SET ACTION=build
IF "%SESSION%"=="build" SET SESSION=session

SET CONTAINER_NAME=opencode-%SESSION%
SET "USER_DRIVE=%~dp0."

IF "%ACTION%"=="build" (
    echo Rebuild de l'image...
    docker rm -f %CONTAINER_NAME% >nul 2>&1
    docker build -t mon-opencode -f "%USER_DRIVE%\Dockerfile.opencode" "%USER_DRIVE%"
    echo Build termine.
    goto end
)

IF NOT EXIST "%USERPROFILE%\.config\opencode" mkdir "%USERPROFILE%\.config\opencode"
IF NOT EXIST "%USERPROFILE%\.local\share\opencode" mkdir "%USERPROFILE%\.local\share\opencode"

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
      -v "%USERPROFILE%\.config\opencode:/root/.config/opencode:rw" ^
      -v "%USERPROFILE%\.local\share\opencode:/root/.local/share/opencode:rw" ^
      mon-opencode
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