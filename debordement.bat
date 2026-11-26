@echo off
set BASE=%~dp0sources\applisWeb\debordement-app
echo Demarrage de debordement-app...
docker compose -f "%BASE%\docker-compose.yml" up --build
