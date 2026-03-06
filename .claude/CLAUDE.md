# SHIELD - Instructions pour Claude

---

## 🛑 STOP - AVANT D'ÉCRIRE LA MOINDRE LIGNE DE CODE

**JE LIS CETTE SECTION EN ENTIER AVANT CHAQUE MODIFICATION. C'est une obligation, pas une suggestion.**

---

### 1️⃣ i18n - ZÉRO TEXTE HARDCODÉ

```
❌ INTERDIT :                              ✅ OBLIGATOIRE :
'Erreur lors de...'                        __('error.xxx')
'Veuillez...'                              __('validation.xxx')
'Succès' / 'Chargement...' / 'Aucun...'    __('msg.xxx') / __('ui.xxx')
Tout texte FR visible                      __('module.clé')
```

**Syntaxe selon contexte :**
| Contexte | Syntaxe |
|----------|---------|
| PHP | `__('clé')` |
| JS dans PHTML | `<?= json_encode(__('clé')) ?>` |
| JS pur (.js) | `__('clé')` via i18n.js |
| HTML attr | `title="<?= __('clé') ?>"` |

**AVANT d'écrire : la clé existe dans fr.php ET en.php ? Non → l'ajouter D'ABORD.**

---

### 2️⃣ ACCENTS FRANÇAIS - OBLIGATOIRES

```
❌ INTERDIT :        ✅ CORRECT :
mise a jour          mise à jour
cree / creee         créé / créée
succes               succès
resultat             résultat
termine              terminé
selectionnez         sélectionnez
Fevrier / Aout       Février / Août
supprime             supprimé
echoue               échoué
securite             sécurité
parametres           paramètres
telephone            téléphone
deconnexion          déconnexion
```

---

### 3️⃣ PATHS & URLs - JAMAIS HARDCODÉ

```
❌ INTERDIT :                    ✅ OBLIGATOIRE :
'/var/www/shield/...'            PathHelper::getRootPath()
'/uploads/documents/'            PathHelper::getUploadsPath()
href="/page"                     href="<?= base_url('page') ?>"
fetch('/api/...')                fetch(ShieldConfig.apiUrl + '...')
window.location = '/...'         navigateTo('...')
```

---

### 4️⃣ CSS - DESIGN SYSTEM φ UNIQUEMENT

```
❌ INTERDIT :                    ✅ OBLIGATOIRE :
margin: 15px                     margin: var(--spacing-13) /* Fibonacci */
color: #ff5500                   color: var(--primary)
font-size: 16px                  font-size: var(--text-base)
Styles CTA dans module CSS       Styles CTA dans shield-core.css UNIQUEMENT
```

**Spacing Fibonacci :** 1, 2, 4, 8, 13, 21, 34, 55, 89, 144 px
**Breakpoints φ :** 320, 518, 838, 1355 px

---

### 5️⃣ MVC - SÉPARATION STRICTE

| Couche | SQL | Logique métier | HTML | $_GET/$_POST |
|--------|-----|----------------|------|--------------|
| **Model** | ✅ | ❌ | ❌ | ❌ |
| **Controller** | ❌ | Délègue → Service | ❌ | ✅ |
| **View** | ❌ | ❌ | ✅ | ❌ |
| **Service** | ❌ | ✅ | ❌ | ❌ |

---

### 6️⃣ SERVICES CENTRALISÉS - OBLIGATOIRES

```
❌ INTERDIT :                    ✅ OBLIGATOIRE :
fetch() avec POST/PUT/DELETE     ApiService.post() / .put() / .delete()
console.log pour debug prod      LogService.debug() / .error()
Requête SQL dans Controller      Model ou Trait
```

---

### 7️⃣ SÉCURITÉ

```
❌ INTERDIT :                    ✅ OBLIGATOIRE :
$_POST['id'] direct              (int)$_POST['id']
fetch() sans CSRF                ApiService (CSRF auto)
require_once AVANT try/catch     require_once DANS try/catch
```

---

### 8️⃣ API ENDPOINTS

**Structure obligatoire :**
```php
require '_bootstrap.php';
requireAuth();
requireCsrf(); // POST/PUT/DELETE uniquement
try {
    require_once '...'; // ICI, pas avant
    $controller = new XxxController($db);
    // ...
} catch (Exception $e) { /* ... */ }
```

---

### 9️⃣ AVANT CHAQUE FEATURE, JE VÉRIFIE :

| # | Question | Si non |
|---|----------|--------|
| 1 | Texte visible → `__('clé')` utilisé ? | STOP, corriger |
| 2 | Accents français présents ? | STOP, corriger |
| 3 | Clés i18n existent dans fr.php ET en.php ? | STOP, les ajouter |
| 4 | Paths via helpers (PathHelper, base_url) ? | STOP, corriger |
| 5 | CSS via variables φ ? | STOP, corriger |
| 6 | SQL dans Model uniquement ? | STOP, corriger |
| 7 | ApiService pour POST/PUT/DELETE ? | STOP, corriger |
| 8 | (int) cast sur $_POST/$_GET ? | STOP, corriger |

---

### 🔴 EXEMPLE - CE QUE JE NE DOIS JAMAIS FAIRE :

```php
// ❌ TOUT EST FAUX ICI :
showNotification('Erreur lors de l\'enregistrement', 'error');  // Hardcodé
showToast('Alerte mise a jour', 'success');                     // Accent manquant
fetch('/api/contacts/delete', { method: 'POST' });              // Pas ApiService
$id = $_POST['id'];                                             // Pas de cast
```

### 🟢 EXEMPLE - CE QUE JE DOIS FAIRE :

```php
// ✅ CORRECT :
// 1. D'ABORD j'ajoute dans fr.php : 'error.saving' => 'Erreur lors de l\'enregistrement',
// 2. D'ABORD j'ajoute dans en.php : 'error.saving' => 'Error while saving',
// 3. ENSUITE j'écris :
showNotification(<?= json_encode(__('error.saving')) ?>, 'error');
showToast(<?= json_encode(__('sos.alert_updated')) ?>, 'success');
await ApiService.delete('contacts/delete', { id: contactId });
$id = (int)$_POST['id'];
```

---

**⚠️ Si je ne respecte pas ces règles, je crée de la dette technique. Le code doit être propre DÈS LA PREMIÈRE ÉCRITURE.**

---

## AUTO-VALIDATION OBLIGATOIRE - AVANT CHAQUE LIVRAISON

### Checklist BLOQUANTE - AVANT de livrer du code

| # | Vérification | Si non respecté |
|---|--------------|-----------------|
| 1 | **ACCENTS FRANÇAIS** - Tous les textes FR ont é è ê ë à â ù û ü ô î ï ç ? | STOP et corriger |
| 2 | **i18n** - Tous les textes visibles utilisent `__('clé')` ? | STOP et corriger |
| 3 | **PATHS** - Aucun chemin hardcodé ? (PathHelper obligatoire) | STOP et corriger |
| 4 | **URLs** - `base_url()`, `asset_url()`, `api_url()` utilisés ? | STOP et corriger |
| 5 | **Design System** - Variables CSS uniquement ? (0% custom, 0 px hardcodé) | STOP et corriger |
| 6 | **CONTRASTE** - Texte lisible sur fond ? (pas blanc/clair, pas sombre/sombre) | STOP et corriger |
| 7 | **FIBONACCI** - Spacing uniquement 1,2,4,8,13,21,34,55,89,144px ? | STOP et corriger |
| 8 | **RESPONSIVE** - Fonctionne en 320px, 518px, 838px, 1355px ? (breakpoints φ) | STOP et corriger |
| 9 | **MVC** - Pas de SQL dans Controller ? Pas de HTML dans Model ? | STOP et corriger |
| 10 | **DESIGN PATTERNS** - Services centralisés utilisés ? (ApiService) | STOP et corriger |
| 11 | **i18n JS** - Pas de `'<?= __() ?>'` ni `addslashes(__())` dans `<script>` ? `json_encode()` obligatoire | STOP et corriger |
| 12 | **i18n ATTR** - Pas de `title=__()`, `aria-label=__()` ? Toujours avec guillemets + interpolation | STOP et corriger |
| 13 | **CSRF META** - Pages standalone avec POST ont `<meta name="csrf-token">` ? | STOP et corriger |
| 14 | **CSRF/ApiService** - Aucun `fetch()` avec `method: POST/PUT/DELETE` ? Toujours `ApiService.post()` / `.put()` / `.delete()` | STOP et corriger |
| 15 | **STRICT TYPES** - `$id` du routing casté en `(int)` avant passage aux Traits/Services strict-typés ? | STOP et corriger |
| 16 | **$_POST/$_GET CAST** - Toujours `(int)$_POST['id']` avant appel méthode strict-typée ? | STOP et corriger |
| 17 | **CTA OVERFLOW** - Boutons d'action avec `overflow: hidden` ? Conteneurs avec `overflow: visible` ? | STOP et corriger |
| 18 | **CTA CENTRALISATION** - Styles CTAs uniquement dans `shield-core.css` ? Pas de duplication dans modules ? | STOP et corriger |
| 19 | **i18n SYNC** - Clés fr.php = en.php ? Exécuter `node scripts/i18n-validator.js` | STOP et corriger |
| 20 | **i18n HARDCODÉ** - Aucun `'Veuillez...'`, `'Erreur'`, `'Succès'` hardcodé ? Toujours `__('clé')` | STOP et corriger |

### Checklist BLOQUANTE - APRÈS un deploy

| # | Action | Commande |
|---|--------|----------|
| 1 | **Attendre GitHub Actions** | `gh run list --limit 3` |
| 2 | **Vérifier HTTP 200** | `curl -sI https://stabilis-it.ch/internal/shield/health` |
| 3 | **Test Playwright PROD** | `npx playwright test --headed` |

---

## RÈGLES FONDAMENTALES

### RÈGLE ZÉRO - JAMAIS DE BYPASS

**Quand un test échoue ou qu'un déploiement bloque, tu ne contournes JAMAIS.**

| ❌ INTERDIT | ✅ OBLIGATOIRE |
|-------------|----------------|
| Ajouter `--skip-tests` | Corriger le code qui fait échouer le test |
| Modifier deploy.sh pour contourner | Corriger le problème à la source |
| Modifier les validateurs pour ignorer | Corriger le code qui viole les règles |
| Commenter une vérification | Corriger ce qui est vérifié |

### RÈGLE UN - ZÉRO MANUEL

**L'utilisateur ne fait JAMAIS RIEN manuellement. JAMAIS.**

| ❌ INTERDIT | ✅ OBLIGATOIRE |
|-------------|----------------|
| "Tu peux lancer X manuellement" | Automatiser X dans un workflow |
| "Exécute cette commande" | Intégrer dans deploy.sh ou GitHub Actions |
| "Clique sur ce bouton" | Script qui fait l'action |
| "Vérifie manuellement" | Test automatisé (Playwright) |

### RÈGLE URL TESTS

**URL obligatoire pour les tests : `http://127.0.0.1:8085/...` (jamais `localhost`)**

---

## RÈGLES CTA / BOUTONS D'ACTION - CENTRALISATION OBLIGATOIRE

**Source unique :** `shield-core.css` section CTAs
**Jamais de styles CTA dans les modules**

| ❌ INTERDIT (BLOQUANT) | ✅ OBLIGATOIRE |
|------------------------|----------------|
| `overflow: visible` sur boutons CTA | `overflow: hidden !important` sur boutons |
| `overflow: hidden` sur conteneurs (td, .actions-cell) | `overflow: visible !important` sur conteneurs |
| Définir `.action-btn` dans un module CSS | Référencer `shield-core.css` uniquement |
| Tailles icônes en pixels (`24px`, `26px`) | Variables Fibonacci (`var(--spacing-21)`, `var(--spacing-34)`) |

---

## ARCHITECTURE DES DOSSIERS

```
shield/
├── backend/php/           <- CODE SOURCE UNIQUE
│   ├── Controllers/, Models/, Views/, Services/, Helpers/
│   ├── Middleware/, lang/, config/
│   └── bootstrap.php
├── public/                <- Fichiers accessibles publiquement
│   ├── index.php, api/, assets/, uploads/
│   └── manifest.json, service-worker.js
├── database/migrations/
├── tests/playwright/      <- Tests E2E (seul framework autorisé)
├── docker/
├── scripts/               <- Scripts deploy, validators
└── android/, ios/         <- Capacitor (auto-généré)
```

---

## CONFIGURATION URLs

| Environnement | Base Path | Port |
|---------------|-----------|------|
| **Localhost** | `` (vide) | 8085 |
| **Production** | `/internal/shield` | - |

**PHP :** `base_url()`, `asset_url()`, `api_url()`, `redirect_to()`, `versioned_asset()`
**JS :** `ShieldConfig.apiUrl`, `ShieldConfig.basePath`, `navigateTo()`

---

## DESIGN SYSTEM - NOMBRE D'OR φ = 1.618

### Palette SHIELD

```css
--primary: #8E24AA;          /* Violet profond - Navigation, boutons */
--primary-light: #B259CB;    /* Violet clair - Hover */
--primary-dark: #6A1B9A;     /* Violet sombre */
--danger: #F44336;           /* Rouge alerte - SOS actif */
--danger-light: #FF5252;     /* Rouge clair */
--success: #4CAF50;          /* Vert rassurant - Sécurité */
--success-light: #81C784;    /* Vert clair */
--warning: #FF9800;          /* Orange - Alertes */
--warning-light: #FFB74D;    /* Orange clair */
--background: #1A1A2E;       /* Nuit profonde - Fond */
--surface: #2A2A4E;          /* Surface - Cartes */
--surface-light: #3A3A5E;    /* Surface claire */
--accent: #E91E8C;           /* Rose électrique - CTAs */
--accent-light: #FF4DB8;     /* Rose clair */
--text-primary: #FFFFFF;     /* Blanc */
--text-secondary: #B0B0C0;   /* Gris clair */
--text-muted: #6B6B7B;       /* Gris */
```

### Spacing Fibonacci

```css
--spacing-1: 1px;
--spacing-2: 2px;
--spacing-4: 4px;
--spacing-8: 8px;
--spacing-13: 13px;
--spacing-21: 21px;
--spacing-34: 34px;
--spacing-55: 55px;
--spacing-89: 89px;
--spacing-144: 144px;
```

### Breakpoints φ

```css
--breakpoint-xs: 320px;   /* Mobile portrait */
--breakpoint-sm: 518px;   /* Mobile landscape / petit tablet */
--breakpoint-md: 838px;   /* Tablet */
--breakpoint-lg: 1355px;  /* Desktop */
```

---

## ARCHITECTURE VPS MULTI-PROJETS

### Structure URLs sur stabilis-it.ch

| URL | Projet |
|-----|--------|
| `stabilis-it.ch/` | Site principal (Helios) |
| `stabilis-it.ch/internal/helios` | App Helios |
| `stabilis-it.ch/internal/tripsalama` | App TripSalama |
| `stabilis-it.ch/internal/shield` | **App SHIELD** |

### Fichiers nginx

| Fichier | Géré par |
|---------|----------|
| `/etc/nginx/sites-enabled/helios` | Helios (config HOST) |
| `/etc/nginx/snippets/tripsalama.conf` | TripSalama |
| `/etc/nginx/snippets/shield.conf` | **SHIELD** |

### RÈGLES DE NON-INTERFÉRENCE (BLOQUANTES)

| ❌ INTERDIT | ✅ OBLIGATOIRE |
|-------------|----------------|
| SHIELD modifie configs d'autres projets | SHIELD modifie UNIQUEMENT son snippet |
| Supprimer des includes d'autres projets | Conserver tous les includes existants |

---

## TESTS PLAYWRIGHT UNIQUEMENT

- **Puppeteer INTERDIT**
- Configuration mobile-first (Pixel 5, iPhone 13)
- `npx playwright test --headed` pour tests visuels

```bash
# Lancer tous les tests
npx playwright test --headed

# Test spécifique
npx playwright test tests/playwright/smoke-auth.spec.ts --headed

# Test avec un seul projet
npx playwright test --project="Desktop Chrome" --headed
```

---

## i18n - RÈGLES STRICTES

### Fichiers de traduction

| Système | FR | EN |
|---------|----|----|
| **PHP** | `backend/php/lang/fr.php` | `backend/php/lang/en.php` |

### Règles BLOQUANTES

| ❌ INTERDIT (BLOQUANT) | ✅ OBLIGATOIRE |
|------------------------|----------------|
| Texte français hardcodé dans JS/PHP | Utiliser `__('clé')` |
| `'Veuillez...'` hardcodé | `__('msg.please_wait')` |
| `'Erreur'` hardcodé | `__('msg.error')` |
| Clé sans valeur (affiche la clé brute) | Ajouter la valeur dans FR + EN |
| `'mise a jour'` sans accents | `'mise à jour'` avec accents |
| `'cree'` sans accents | `'créé'` avec accents |
| Clé dans fr.php mais pas en.php | Synchroniser les 2 fichiers |

### Validation automatique

```bash
# Valider les traductions avant commit
node scripts/i18n-validator.js

# Mode strict (échoue sur warnings)
node scripts/i18n-validator.js --strict
```

### JS injection dans PHP

```php
// ✅ CORRECT
<script>
const msg = <?= json_encode(__('key')) ?>;
</script>

// ❌ INTERDIT
<script>
const msg = '<?= __('key') ?>';  // XSS + accents cassés
const msg = '<?= addslashes(__('key')) ?>';  // Mauvais encoding
</script>
```

---

## FONCTIONNALITÉS CRITIQUES SHIELD

### Déclenchement SOS (<2s)

- 5 taps rapides sur écran
- Bouton volume maintenu 3s
- Bouton SOS visible

### Agent IA Vocal

- Twilio pour appels
- Deepgram pour STT
- ElevenLabs pour TTS
- OpenAI pour logique conversationnelle

### Contacts de Confiance

- Maximum 5 contacts
- SMS + Push + Appel
- Géolocalisation temps réel

### Services d'Urgence

- 10 pays européens supportés
- Numéros locaux automatiques
- Escalade progressive

### Mode Silencieux

- Pour violences conjugales
- Pas d'alarme sonore
- Alerte discrète aux contacts

---

## COMMANDES UTILES

```bash
# Docker
npm run docker:up          # Démarrer les conteneurs
npm run docker:rebuild     # Reconstruire et démarrer
npm run docker:logs        # Voir les logs

# Tests
npm test                   # Tests Playwright (headed)
npm run test:headless      # Tests Playwright (headless)

# Validation
npm run i18n:validate      # Valider les traductions

# Déploiement
npm run deploy             # Trigger GitHub Actions deploy
```

---

---

## PRE-COMMIT HOOKS - BLOQUANTS ET NON-BYPASSABLES

### Installation OBLIGATOIRE

```bash
# Configurer git pour utiliser les hooks du projet
git config core.hooksPath .githooks

# Vérifier que c'est actif
git config --get core.hooksPath  # Doit afficher: .githooks
```

### Validators exécutés automatiquement

| Validator | Type | Description |
|-----------|------|-------------|
| **Secret Scanner** | BLOQUANT | Détecte tokens/passwords/API keys hardcodés |
| **MVC Validator** | BLOQUANT | SQL dans Controllers/Views = REJETÉ |
| **Path Validator** | BLOQUANT | Chemins absolus hardcodés = REJETÉ |
| **CSS Design System** | WARNING | Valeurs non-Fibonacci détectées |
| **i18n Validator** | WARNING | Clés fr.php ≠ en.php |

### JAMAIS bypasser les hooks

| ❌ STRICTEMENT INTERDIT | ✅ OBLIGATOIRE |
|-------------------------|----------------|
| `git commit --no-verify` | Corriger le code qui bloque |
| Supprimer `.githooks/pre-commit` | Garder le hook actif |
| Modifier les validators pour ignorer | Corriger le code source |
| `SKIP_HOOKS=1 git commit` | Comprendre pourquoi ça bloque et corriger |

---

## DÉPLOIEMENT - GARDE-FOUS STRICTS

### 1. GitHub Actions (Voie principale)

```bash
# Push déclenche automatiquement le déploiement
git push origin main

# Vérifier le statut
gh run list --limit 3
```

### 2. Fallback Manuel (Si GitHub Actions échoue)

**Le script fallback exécute TOUS les validateurs avant déploiement.**

```bash
# Depuis le projet
./scripts/deploy-fallback.sh

# Options disponibles
./scripts/deploy-fallback.sh --skip-migrations   # Sans migrations
./scripts/deploy-fallback.sh --rollback          # Restaurer backup
```

**PowerShell (Windows) :**
```powershell
.\scripts\Deploy-Fallback.ps1
.\scripts\Deploy-Fallback.ps1 -SkipMigrations
.\scripts\Deploy-Fallback.ps1 -Rollback
```

### 3. Post-deploy vérifications OBLIGATOIRES

| # | Test | Commande | Résultat attendu |
|---|------|----------|------------------|
| 1 | Health check | `curl -sI https://stabilis-it.ch/internal/shield/health` | HTTP 200 |
| 2 | API Health | `curl -sI https://stabilis-it.ch/internal/shield/api/v1/health` | HTTP 200 |
| 3 | Auth protection | `curl -sI https://stabilis-it.ch/internal/shield/api/incidents.php?action=active` | HTTP 401 |
| 4 | Login page | `curl -sI https://stabilis-it.ch/internal/shield/auth/login` | HTTP 200 |

**Si UN test échoue → ROLLBACK IMMÉDIAT**

```bash
./scripts/deploy-fallback.sh --rollback
```

---

## SMOKE TESTS CRITIQUES

### Tests de sécurité

| Test | Description | Échec = BLOQUANT |
|------|-------------|------------------|
| Auth sans token | `/api/incidents.php?action=active` doit retourner 401 | OUI |
| CSRF invalide | POST sans token CSRF doit retourner 403/419 | OUI |
| Rate limiting | 50+ requêtes/min doit retourner 429 | NON (warning) |
| SQL Injection | Paramètres malicieux ne doivent pas casser | OUI |

### Tests fonctionnels

| Test | Description |
|------|-------------|
| Login flow | Email + password → Redirection dashboard |
| SOS trigger | Déclencher alerte → Contacts notifiés |
| Contact CRUD | Ajouter/Modifier/Supprimer contact |
| Location tracking | Position mise à jour en temps réel |

### Commandes tests

```bash
# Tous les tests
npm test

# Tests critiques uniquement (sans headed)
npx playwright test tests/playwright/smoke-critical.spec.ts

# Test spécifique
npx playwright test tests/playwright/test-auth.spec.ts --headed
```

---

## RATE LIMITING - CONFIGURATION

| Endpoint | Limite | Fenêtre | Redis Key |
|----------|--------|---------|-----------|
| `/api/auth/*` | 10 req | 60s | `rate_limit:auth:{ip}` |
| `/api/incidents/trigger` | 5 req | 60s | `rate_limit:sos:{user_id}` |
| `/api/track.php` | 30 req | 60s | `rate_limit:track:{ip}` |
| `/*` (autres) | 60 req | 60s | `rate_limit:default:{ip}` |

**Redis non disponible → Fallback session-based (moins précis mais fonctionnel)**

---

## API PUBLIQUES - SÉCURITÉ RENFORCÉE

### Endpoint `/api/track.php` (Public tracking)

| Sécurité | Implémentation |
|----------|----------------|
| Rate limiting strict | 30 req/min par IP |
| Validation UUID | `share_id` format UUID requis |
| Token expiration | Liens expirent après N heures |
| Token révocation | Utilisateur peut révoquer |

### Endpoints authentifiés

| Header | Requis |
|--------|--------|
| `Authorization: Bearer {jwt}` | OUI pour tous |
| `X-CSRF-Token` | OUI pour POST/PUT/DELETE (web) |

---

## DATABASE - MIGRATIONS

### Structure des migrations

```
database/migrations/
├── 001_users.sql
├── 002_trusted_contacts.sql
├── 003_incidents.sql
├── 004_incident_locations.sql
├── 005_notifications.sql
├── 006_incident_notifications.sql
└── 007_incident_shares.sql
```

### Table de suivi `migrations`

```sql
CREATE TABLE IF NOT EXISTS migrations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    migration VARCHAR(255) NOT NULL,
    executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Le script de déploiement applique automatiquement les nouvelles migrations.**

---

## LEÇONS APPRISES

### 1. Traductions et Accept-Language
Le navigateur envoie `Accept-Language: en` → PHP charge `en.php`.
**Toujours synchroniser fr.php ET en.php.**

### 2. Docker bind mounts
Les modifications de fichiers sont visibles immédiatement dans le conteneur.
**Mais OPcache peut cacher les vieux fichiers → `docker restart` si besoin.**

### 3. Port 80 déjà utilisé
Helios utilise le port 80. SHIELD utilise **8085**.
**Ne jamais changer ce port sans vérifier les conflits.**

### 4. Nginx rewrite critique
Le host nginx reçoit `/internal/shield/assets/...` mais l'app attend `/assets/...`.
**Le rewrite dans nginx-shield.conf est CRITIQUE.**

### 5. Redis port 6380 (pas 6379)
SHIELD utilise Redis sur le port **6380** pour éviter conflit avec Helios (6379).
**Variables d'env : `REDIS_HOST=127.0.0.1`, `REDIS_PORT=6380`**

### 6. SQL dans IncidentController = INTERDIT
Même pour des requêtes "simples", toute requête SQL doit être dans un Model ou un Trait.
**Le validator MVC bloque automatiquement les violations.**

### 7. VolumeButtonsPlugin - Capacitor natif
Le plugin de boutons volume est en JavaScript pur pour le web, Capacitor pour natif.
**Ne jamais tester la détection volume dans le navigateur desktop.**

### 8. Tables partagées incident_shares et contact_responses
Ces tables supportent le tracking public. **Le share_id est un UUID public**, pas un ID séquentiel.
**Ne jamais exposer l'incident_id directement.**

### 9. Rate limiting Redis vs Session
Redis est préférable mais optionnel. Sans Redis, le rate limiting utilise $_SESSION.
**Toujours implémenter les deux mécanismes.**

### 10. Chemins Windows vs Unix dans validators
Les validators doivent normaliser les chemins (`/` partout) avant comparaison.
**Utiliser `.replace(/\\/g, '/')` pour compatibilité cross-platform.**

### 11. Pre-commit DOIT bloquer, pas juste warning
Les validateurs de sécurité (secrets, MVC) doivent être BLOQUANTS.
**Exit code 1 = commit rejeté. Pas de bypass possible.**

### 12. Fallback deployment - Validators AVANT rsync
Le script fallback doit exécuter TOUS les validators avant de toucher au serveur.
**Si un validator échoue, le déploiement s'arrête immédiatement.**

---

---

## 🔴 TESTS E2E OBLIGATOIRES - RÈGLE INSTITUTIONNELLE

### AUCUNE FEATURE N'EST "TERMINÉE" SANS TESTS COMPLETS

**Cette règle est NON-NÉGOCIABLE. Pas d'exception. Pas de bypass.**

| ❌ STRICTEMENT INTERDIT | ✅ OBLIGATOIRE |
|-------------------------|----------------|
| "Je ferai les tests plus tard" | Tests écrits AVEC la feature |
| "Cette feature est simple, pas besoin de tests" | TOUTES les features ont des tests |
| "Les tests sont optionnels" | Les tests sont BLOQUANTS |
| "Je n'ai pas le temps pour les tests" | Pas de temps = pas de feature |
| Tester manuellement et considérer ça suffisant | Tests Playwright automatisés |

### Structure des tests E2E

```
tests/playwright/
├── helpers/
│   └── test-auth.ts          # Helper authentification
├── e2e/
│   ├── auth-complete.spec.ts     # TOUS les scénarios auth
│   ├── contacts-complete.spec.ts # TOUS les scénarios contacts
│   ├── incidents-complete.spec.ts # TOUS les scénarios SOS
│   ├── settings-complete.spec.ts  # TOUS les scénarios settings
│   ├── sharing-complete.spec.ts   # TOUS les scénarios partage
│   └── history-complete.spec.ts   # TOUS les scénarios historique
├── smoke-auth.spec.ts
├── smoke-app.spec.ts
└── smoke-critical.spec.ts
```

### Couverture MINIMALE par feature

| Feature | Tests requis |
|---------|--------------|
| **Auth** | Login (succès, échec, validation), Register (succès, échec, email existant, password faible), Forgot Password, Logout, Session persistence |
| **Contacts** | CRUD complet (Create, Read, Update, Delete), Validation (téléphone, limite 5), Test SMS, Réorganisation priorité |
| **SOS/Incidents** | Déclenchement (normal, discret, volume buttons), Incident actif (statut, timer, carte), Annulation (PIN, fausse alerte), Escalade, Géolocalisation |
| **Settings** | Profil, Préférences SOS, Notifications, PIN, Langue, Thème, Suppression compte |
| **Sharing** | Génération lien, Page publique tracking, Actions contacts (acknowledge, responding, arrived), SMS, Révocation |
| **History** | Liste, Filtres, Détails, Timeline, Export, Stats |

### Commande pour vérifier la couverture

```bash
# Lancer TOUS les tests E2E
npx playwright test tests/playwright/e2e/ --headed

# Test spécifique
npx playwright test tests/playwright/e2e/auth-complete.spec.ts --headed

# Vérifier qu'aucun test ne manque
npm run test:coverage  # Script à ajouter
```

### AVANT de considérer une feature comme terminée

| # | Question | Si NON |
|---|----------|--------|
| 1 | Tests E2E écrits pour TOUS les scénarios ? | FEATURE NON TERMINÉE |
| 2 | Tests passent en local ? | FEATURE NON TERMINÉE |
| 3 | Tests couvrent les cas d'erreur ? | FEATURE NON TERMINÉE |
| 4 | Tests couvrent la validation des inputs ? | FEATURE NON TERMINÉE |
| 5 | Tests API présents ? | FEATURE NON TERMINÉE |

### Le pre-commit BLOQUE si tests manquants

**Le hook pre-commit vérifie que les tests associés aux fichiers modifiés passent.**

```bash
# Exemple: modifier backend/php/Controllers/ContactController.php
# → Le hook exécute tests/playwright/e2e/contacts-complete.spec.ts
# → Si le test échoue = COMMIT REJETÉ
```

---

## CHECKLIST RAPIDE - AVANT CHAQUE COMMIT

```
□ Accents français présents dans tous les textes FR
□ Clés i18n dans fr.php ET en.php
□ Pas de SQL dans Controllers ou Views
□ Pas de chemins absolus hardcodés
□ Pas de tokens/passwords dans le code
□ Variables CSS Fibonacci uniquement
□ (int) cast sur tous les $_GET/$_POST
□ ApiService pour POST/PUT/DELETE
□ json_encode() pour i18n dans <script>
□ TESTS E2E ÉCRITS ET PASSANTS
```

## CHECKLIST RAPIDE - AVANT CHAQUE DEPLOY

```
□ Tous les tests passent localement
□ Pre-commit hooks passent
□ Pas de fichiers non commités
□ Branch = main
□ Commits poussés sur origin
```

## CHECKLIST RAPIDE - APRÈS CHAQUE DEPLOY

```
□ curl health check = 200
□ curl API health = 200
□ curl protected endpoint = 401
□ Login page accessible
□ Tests Playwright passent
```
