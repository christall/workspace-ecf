#!/bin/bash
# Installation ERP CERCA — Linux / macOS / WSL
set -e

echo "📦 Installation des dépendances..."
npm install

echo "🗄️  Création de la base de données et injection des données de démo..."
mkdir -p db
npm run db:seed

echo ""
echo "✅ Installation terminée !"
echo ""
echo "   Démarrer l'application : npm run dev"
echo "   Ouvrir : http://localhost:3000"
echo ""
echo "   Comptes de démo :"
echo "   • admin@cerca.fr     → Administrateur"
echo "   • sec@cerca.fr       → Secrétaire"
echo "   • m.brunet@cerca.fr  → Moniteur"
echo "   Mot de passe : Demo1234!"
