@echo off
echo Installation ERP CERCA — Windows
echo.
echo IMPORTANT : si vous avez copie ce dossier depuis Linux/WSL,
echo supprimez d'abord le dossier node_modules avant de continuer.
echo.

echo Installation des dependances...
call npm install
if errorlevel 1 goto error

if not exist db mkdir db
if not exist db\erp.db (
    echo Creation de la base avec donnees de demo...
    call npm run db:seed
    if errorlevel 1 goto error
) else (
    echo Base de donnees existante conservee ^(db\erp.db^).
)

echo.
echo Installation terminee !
echo.
echo   Demarrer          : npm run dev
echo   Ouvrir            : http://localhost:3000
echo.
echo   Comptes demo :
echo   - admin@cerca.fr     / Demo1234!
echo   - sec@cerca.fr       / Demo1234!
echo   - m.brunet@cerca.fr  / Demo1234!
echo.
echo   Pour importer des vraies donnees GPLearn (ex: gp1702) :
echo   set MYSQL_HOST=localhost
echo   set MYSQL_USER=root
echo   set MYSQL_PASSWORD=votre_mot_de_passe
echo   set MYSQL_DATABASE=gp1702
echo   npm run db:import
goto end

:error
echo ERREUR lors de l'installation. Verifiez que Node.js 18+ est installe.

:end
pause
