# SHIELD - Audit UI/UX Complet

**Date:** 11 Mars 2026
**Auditeur:** Claude Code (Front Designer / CSS Expert / UX/UI)
**URL:** https://stabilis-it.ch/internal/shield
**Outil:** Playwright (mode visuel)

---

## Sommaire Exécutif

| Métrique | Valeur |
|----------|--------|
| **Pages auditées** | 12 |
| **Screenshots capturés** | 12 |
| **Problèmes détectés** | 151 |
| **Critiques** | 0 |
| **Hauts** | 43 |
| **Moyens** | 108 |
| **Score Design System** | 8/10 |
| **Score UX** | 6/10 |
| **Score Accessibilité** | 5/10 |

---

## 1. Points Forts du Design Actuel

### 1.1 Design System Solide

Le design system `shield-core.css` est **exemplaire** :

| Aspect | Évaluation | Notes |
|--------|------------|-------|
| **Variables CSS** | Excellent | 50+ variables bien organisées |
| **Spacing Fibonacci** | Excellent | 1, 2, 4, 8, 13, 21, 34, 55, 89, 144px |
| **Typography Golden Ratio** | Excellent | Échelle cohérente 1.2x |
| **Z-index Scale** | Excellent | Échelle ordonnée 100-9999 |
| **Theme Support** | Bon | Dark/Light themes |
| **Transitions** | Bon | Fast/Normal/Slow définis |

### 1.2 Identité Visuelle

- **Palette cohérente** : Violet (#8E24AA) + Rose (#E91E8C) + Rouge SOS (#F44336)
- **Logo reconnaissable** : Bouclier avec éclair
- **Tagline mémorable** : "Votre sécurité, notre priorité"
- **Glassmorphism subtil** : Effet moderne sans excès

### 1.3 Mobile-First

- Design conçu pour mobile en priorité
- Formulaires adaptés au scroll vertical
- Boutons CTA bien dimensionnés (principal)

---

## 2. Problèmes Prioritaires (HAUTS)

### 2.1 Touch Targets Insuffisants (43 occurrences)

**Problème critique pour une app mobile de sécurité !**

| Élément | Taille actuelle | Minimum requis |
|---------|-----------------|----------------|
| Lien "Mot de passe oublié" | 54x17px | 44x44px |
| Lien "S'inscrire" | 78x17px | 44x44px |
| Lien "conditions d'utilisation" | 142x37px | 44x44px |
| Bouton back pages légales | 36-40x40px | 44x44px |
| Liens email (privacy@...) | 168x21px | 44x44px |

**Impact:** Dans une situation de stress/urgence, l'utilisatrice doit pouvoir taper facilement sur tous les éléments.

**Correction requise:**

```css
/* Augmenter les touch targets */
.auth-footer a,
.text-link,
a:not(.btn) {
    display: inline-block;
    min-height: 44px;
    padding: var(--spacing-13) var(--spacing-8);
    line-height: 44px;
}

.btn-back {
    min-width: 44px;
    min-height: 44px;
}
```

### 2.2 Inputs Hidden (Type Hidden mal détectés)

Les éléments `<input type="hidden">` sont détectés comme 0x0px. Ce n'est pas un vrai problème mais pollue le rapport.

---

## 3. Problèmes Moyens

### 3.1 Accessibilité Labels

| Problème | Occurrences | Pages |
|----------|-------------|-------|
| Inputs sans label visible | 12 | Login, Register, Forgot |
| Utilisation placeholder seul | 6 | Tous les formulaires |

**Correction:**
```html
<!-- Actuel (problématique) -->
<label for="email">Adresse email</label>
<input placeholder="votre@email.com">

<!-- Mieux : label visible + placeholder -->
<label for="email" class="form-label">Adresse email</label>
<input id="email" placeholder="votre@email.com" aria-describedby="email-help">
<small id="email-help" class="sr-only">Entrez votre adresse email</small>
```

### 3.2 Contraste Texte Secondaire

Le texte gris (`--text-secondary: #B0B0C0`) sur fond sombre (`--background: #1A1A2E`) a un ratio de contraste **estimé à 5.8:1** (acceptable mais limite pour WCAG AAA).

**Recommandation:**
```css
/* Améliorer le contraste */
--text-secondary: #C8C8D8; /* Plus clair */
```

### 3.3 Cursor Pointer Manquant

Certains éléments interactifs n'ont pas `cursor: pointer`.

```css
/* Ajouter globalement */
button,
[role="button"],
.btn,
.clickable,
input[type="checkbox"],
input[type="radio"],
select {
    cursor: pointer;
}
```

---

## 4. Recommandations UI par Page

### 4.1 Page Login

| Aspect | État | Recommandation |
|--------|------|----------------|
| Logo | Bon | - |
| Formulaire | Bon | - |
| Bouton CTA | Excellent | Gradient bien visible |
| OAuth | Bon | Icônes Google/Facebook corrects |
| Lien "Mot de passe oublié" | À améliorer | Augmenter touch target |
| Remember me | À améliorer | Checkbox trop petite |

**Améliorations suggérées:**

1. **Checkbox plus grande**
```css
.form-checkbox {
    width: 24px;
    height: 24px;
    accent-color: var(--primary);
}
```

2. **Animation bouton connexion**
```css
.btn-primary:active {
    transform: scale(0.98);
}
```

### 4.2 Page Register

| Aspect | État | Recommandation |
|--------|------|----------------|
| Nombre de champs | Beaucoup | Considérer étapes multiples |
| Préfixe téléphone | Bon | +41 par défaut (Suisse) |
| Force mot de passe | Invisible | Afficher indicateur |
| CGU link | À améliorer | Touch target |

**Améliorations suggérées:**

1. **Indicateur force mot de passe visible**
```css
#password-strength {
    margin-top: var(--spacing-8);
    height: 4px;
    border-radius: var(--radius-full);
    transition: var(--transition-normal);
}
.strength-weak { background: var(--danger); width: 33%; }
.strength-medium { background: var(--warning); width: 66%; }
.strength-strong { background: var(--success); width: 100%; }
```

2. **Progress indicator pour formulaire long**
```html
<div class="register-progress">
    <span class="step active">1</span>
    <span class="step">2</span>
    <span class="step">3</span>
</div>
```

### 4.3 Page Forgot Password

| Aspect | État | Recommandation |
|--------|------|----------------|
| Design | Excellent | Cohérent avec login |
| Instructions | Clair | - |
| Bouton CTA | Bon | - |
| Lien retour | À améliorer | Touch target |

### 4.4 Pages Légales (Privacy, Terms, Help)

| Aspect | État | Recommandation |
|--------|------|----------------|
| Structure | Bonne | Sections numérotées |
| Lisibilité | Bonne | Line-height correct |
| Bouton back | À améliorer | 40x40 → 44x44px minimum |
| Liens | À améliorer | Touch targets |
| Style FAQ (Help) | Excellent | Cards bien différenciées |

---

## 5. Design System - Améliorations Suggérées

### 5.1 Nouvelle Variable pour Touch Targets

```css
:root {
    /* Touch target minimum */
    --touch-min: 44px;

    /* Utilisation */
    --btn-min-height: var(--touch-min);
    --link-min-height: var(--touch-min);
}
```

### 5.2 Focus States Améliorés

```css
/* Focus visible pour accessibilité clavier */
:focus-visible {
    outline: 2px solid var(--primary);
    outline-offset: 2px;
}

/* Supprimer outline par défaut uniquement si focus-visible supporté */
@supports selector(:focus-visible) {
    :focus:not(:focus-visible) {
        outline: none;
    }
}
```

### 5.3 Reduced Motion Support

```css
@media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
    }
}
```

### 5.4 Safe Area pour Mobiles Modernes

```css
body {
    padding-top: env(safe-area-inset-top);
    padding-bottom: env(safe-area-inset-bottom);
    padding-left: env(safe-area-inset-left);
    padding-right: env(safe-area-inset-right);
}
```

---

## 6. Améliorations UX Recommandées

### 6.1 Micro-interactions

| Action | Animation suggérée |
|--------|-------------------|
| Bouton hover | `transform: translateY(-2px)` |
| Bouton active | `transform: scale(0.98)` |
| Input focus | `border-color` transition |
| Checkbox toggle | `scale` + couleur |
| Toast apparition | `slideIn` depuis le haut |

### 6.2 Feedback Utilisateur

```css
/* Loading state pour boutons */
.btn.loading {
    pointer-events: none;
    opacity: 0.7;
}
.btn.loading .btn-text { visibility: hidden; }
.btn.loading .btn-spinner { display: block; }

/* Success flash */
@keyframes successFlash {
    0% { background-color: var(--success); }
    100% { background-color: transparent; }
}
.success-flash {
    animation: successFlash 1s ease-out;
}
```

### 6.3 Error States Améliorés

```css
.form-input.error {
    border-color: var(--danger);
    background-color: rgba(var(--danger-rgb), 0.05);
    animation: shake 0.3s ease-in-out;
}

@keyframes shake {
    0%, 100% { transform: translateX(0); }
    20%, 60% { transform: translateX(-5px); }
    40%, 80% { transform: translateX(5px); }
}
```

---

## 7. Checklist Corrections Prioritaires

### Priorité 1 - CRITIQUE (Cette semaine)

- [ ] **Augmenter tous les touch targets à 44px minimum**
  - Liens texte dans formulaires
  - Boutons back pages légales
  - Liens email

- [ ] **Ajouter `cursor: pointer` globalement**

- [ ] **Ajouter `:focus-visible` states**

### Priorité 2 - IMPORTANT (Sous 2 semaines)

- [ ] Améliorer contraste texte secondaire
- [ ] Checkbox login plus grande
- [ ] Indicateur force mot de passe visible (register)
- [ ] Labels accessibles pour screen readers

### Priorité 3 - SOUHAITABLE (Backlog)

- [ ] Ajouter `prefers-reduced-motion` support
- [ ] Safe area insets pour iPhone X+
- [ ] Micro-interactions sur boutons
- [ ] Progress indicator formulaire inscription

---

## 8. Métriques à Suivre

| Métrique | Outil | Objectif |
|----------|-------|----------|
| Lighthouse Accessibility | Chrome DevTools | > 90 |
| Touch target compliance | Audit manuel | 100% |
| Contrast ratio | WebAIM | > 4.5:1 partout |
| First Contentful Paint | Lighthouse | < 1.5s |
| Time to Interactive | Lighthouse | < 3s |

---

## 9. Conclusion

Shield possède un **excellent design system** avec une identité visuelle forte adaptée à son public cible (sécurité féminine). Les couleurs violet/rose sont appropriées et le dark theme offre un bon confort visuel.

**Points forts:**
- Design system Fibonacci/Golden Ratio bien implémenté
- Mobile-first cohérent
- Palette de couleurs adaptée
- Glassmorphism moderne

**Points à améliorer en priorité:**
- Touch targets trop petits (critique pour app d'urgence)
- Accessibilité clavier et screen readers
- Feedback utilisateur (loading, success, error states)

**Score global: 7/10** - Excellent potentiel, corrections accessibilité nécessaires.

---

*Rapport généré automatiquement par audit Playwright UI/UX*
*Screenshots: `tests/playwright/reports/ui-ux-audit/`*
