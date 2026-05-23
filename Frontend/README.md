<div align="center">

# 🎯 JobRadar

### Agrégateur d'offres d'emploi avec scoring IA — tous secteurs

*Trouvez l'offre qui vous correspond vraiment, peu importe votre métier.*

[![Java](https://img.shields.io/badge/Java-17-orange.svg)](https://www.java.com/)
[![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.4-brightgreen.svg)](https://spring.io/projects/spring-boot)
[![Angular](https://img.shields.io/badge/Angular-18-red.svg)](https://angular.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791.svg)](https://www.postgresql.org/)
[![Claude](https://img.shields.io/badge/Claude-API-D97757.svg)](https://www.anthropic.com/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

[🚀 Démo](https://jobradar.fr) · [📊 Swagger](https://jobradar.fr/swagger-ui.html) · [💼 Portfolio](https://nourstack.netlify.app)

</div>

---

## 💡 Le projet en 1 minute

> **Problème** : 6M de Français cherchent un emploi chaque année. Ils perdent 11h/semaine sur 5 sites différents.
>
> **Solution** : JobRadar agrège **1M+ offres** via l'API France Travail, **score chaque offre** selon le profil candidat (moteur IA adaptatif Claude), et automatise lettres + suivi Kanban.
>
> **Impact** : **−70% de temps de recherche** · Lettres générées en 10 s · Suivi structuré de toutes les candidatures.

---

## 🎯 Ce qui rend ce projet unique

| 🔥 | Différenciateur |
|---|---|
| 🌍 | **14 secteurs ROME** — Tech, Santé, BTP, Commerce… pas juste de la tech |
| 🧠 | **Scoring adaptatif** — Pondération différente par métier (infirmier ≠ développeur) |
| 🤖 | **IA contextuelle** — Claude API génère lettres et conseils adaptés au secteur |
| 🔐 | **OAuth2 complet** — Google + LinkedIn + email/password, conformité RGPD |
| 📊 | **Source officielle** — API France Travail (1M+ offres légales) |



## 🏗️ Stack technique

| Couche | Technologies |
|---|---|
| **Frontend** | Angular 18 · Standalone Components · Signals · Reactive Forms · Tailwind CSS · PWA |
| **Backend** | Spring Boot 3.4 · Java 17 · Spring Security 6 · JWT · OAuth2 (Google + LinkedIn) |
| **Database** | PostgreSQL 16 · JPA / Hibernate |
| **IA & Data** | Claude API (Sonnet + Haiku) · API France Travail · Python FastAPI |
| **DevOps** | Docker · Maven · GitHub Actions · SonarQube · Kubernetes-ready |

### Architecture

```
┌────────────────────────────────────────┐
│   Angular 18 PWA (Signals + Tailwind)  │
└──────────────────┬─────────────────────┘
                   │ REST + JWT + OAuth2
┌──────────────────▼─────────────────────┐
│  Spring Boot 3.4 — Modules métier      │
│  Auth · Jobs · Matching · Apps · IA    │
└──────┬─────────────────────────┬───────┘
       │                         │
       ▼                         ▼
┌─────────────┐           ┌─────────────┐
│ France Tr.  │           │ PostgreSQL  │
│ + Claude    │           │             │
└─────────────┘           └─────────────┘
```

---

## 📊 Algorithme phare : scoring adaptatif

Le score (0–100) **change selon le métier** — c'est là tout l'intérêt :

| Critère | Tech | Santé | Commerce | BTP |
|---|:---:|:---:|:---:|:---:|
| Compétences techniques | **40%** | 15% | 20% | 30% |
| Diplômes / certifications | 10% | **40%** | 15% | 25% |
| Expérience | 20% | 25% | 25% | 25% |
| Soft skills | 5% | 5% | **30%** | 5% |

→ Implémentation via **Strategy Pattern** (`SectorTemplate`) — ajouter un secteur prend < 4 heures.

---

## ✨ Fonctionnalités livrées

- ✅ Authentification **email/password + OAuth2 Google + LinkedIn**
- ✅ **14 secteurs ROME** France Travail
- ✅ **Scoring adaptatif** par secteur (Strategy Pattern)
- ✅ **API France Travail** intégrée (1M+ offres)
- ✅ **Génération de lettres** par Claude API
- ✅ **Kanban** de suivi des candidatures
- ✅ **Dashboard analytics** personnel
- ✅ Sécurité : JWT + BCrypt + filtre custom + CORS strict
- ⏳ Notifications push, multi-CV, préparation entretien IA (V1.1)

---



## 💼 Vous recrutez ?

**🎯 Recherche active** : CDI Full Stack / DevOps · Alternance DevOps
*Orléans · Paris · Télétravail · Disponible immédiatement*

### Ce que ce projet démontre

| Compétence | Preuve dans le code |
|---|---|
| 🏗️ **Architecture modulaire** | Monolithe Spring Boot avec modules métier découplés |
| 🔐 **Sécurité avancée** | JWT + OAuth2 Google/LinkedIn + Spring Security 6 from scratch |
| 🎨 **UI moderne** | Angular 18 Signals + Tailwind + Reactive Forms |
| 🤝 **Intégration API tierce** | France Travail, Claude API, Google/LinkedIn OAuth |
| 📊 **Algorithmes** | Scoring multi-critères adaptatif (Strategy Pattern) |
| 🚀 **Autonomie complète** | Projet de A à Z : conception → DB → API → UI → déploiement |

**📩 Discutons-en** : [LinkedIn](https://linkedin.com/in/nour-lassoued) · [Email](mailto:nour.lassoued@example.com)

---

