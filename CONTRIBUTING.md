# Contribuer à TRC Community Atlas

Merci de vouloir améliorer Atlas. Les signalements, propositions et correctifs
non commerciaux sont bienvenus, mais le projet demeure sous la propriété de
TheRisingCloud.

## Propriété des contributions

Une demande de fusion n'est admissible que lorsque son auteur a signé une
entente de cession de droits d'auteur approuvée par TheRisingCloud. Une personne
qui contribue pour son employeur doit aussi faire signer la version destinée
aux entités.

La cession permet à TheRisingCloud de demeurer le titulaire unique du projet,
de protéger Atlas et d'accorder séparément des licences commerciales. Le
contributeur reçoit une licence de retour lui permettant d'utiliser sa
contribution selon la licence publique non commerciale d'Atlas.

La politique et les modèles retenus sont décrits dans
[`docs/CONTRIBUTOR_OWNERSHIP.md`](docs/CONTRIBUTOR_OWNERSHIP.md). Aucune
contribution externe ne doit être fusionnée tant que l'entente signée n'est pas
consignée par le mainteneur.

## Règles de contribution

- ouvrir d'abord une issue pour un changement important;
- ne jamais inclure de données client, mot de passe, clé, jeton ou sauvegarde;
- utiliser uniquement des données de test clairement fictives;
- documenter le comportement et ajouter les tests pertinents;
- déclarer tout code, actif ou dépendance provenant d'un tiers;
- conserver l'autonomie locale d'Atlas et l'absence de télémétrie;
- accepter que la demande puisse être refusée, modifiée ou reportée.

## Vérification

Avant une demande de fusion :

```powershell
npm run check
npm test
```

La licence publique se trouve dans [`LICENSE.txt`](LICENSE.txt).
