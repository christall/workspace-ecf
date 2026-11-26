---
name: Bug PIST qte=0 montant non nul — RÉSOLU
description: Bug résolu — cause réelle : agence 7925 décochée comptable, disparue des paramètres de saisie, entraînant une collision de clé unique sur 7901
type: project
originSessionId: 0b5f260b-8f37-403b-a916-e0f16fb6e4cc
---
## Contexte
Base `gp7901`, agences `7901` et `7925`.

## Cause réelle
L'agence `7925` avait été décochée du flag "comptable". Elle disparaissait des "paramètres de saisies" de la validation/saisie des heures. L'interface envoyait alors deux fois l'agence `7901` avec la même famille → violation de clé unique → données destinées à `7925` perdues/écrasées.

## Solution
Recocher l'agence `7925` comme "comptable" → réapparaît dans les paramètres de saisie.

## À retenir
- Flag "comptable" sur une agence conditionne sa présence dans les écrans de saisie/validation des heures
- Une agence absente peut provoquer une collision silencieuse sur une autre agence (clé unique famille+agence)
- La fausse piste `propages_modeles.php` (lignes PIST/TGD avec qte=0) n'était pas la cause.
