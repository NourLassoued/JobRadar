<div align="center">

# 🎯 JobRadar

**Plateforme de recrutement Full Stack avec IA générative, scoring adaptatif et temps réel**

[![Java](https://img.shields.io/badge/Java-21-orange.svg)](https://www.java.com/)
[![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.2-brightgreen.svg)](https://spring.io/projects/spring-boot)
[![Angular](https://img.shields.io/badge/Angular-18-red.svg)](https://angular.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-336791.svg)](https://www.postgresql.org/)
[![IA](https://img.shields.io/badge/IA-Groq%20LLM-F55036.svg)](https://console.groq.com/)

</div>

---

## ⚡ En bref

JobRadar **agrège les offres de 3 API** (France Travail, Adzuna, Jooble), **élimine les doublons**, **calcule la compatibilité** candidat / offre selon le secteur métier et intègre **7 fonctionnalités d'IA générative** pour les candidats et les recruteurs.

Projet conçu et développé **de A à Z** : architecture, base de données, API REST, interface et sécurité.

---

## 🚀 Fonctionnalités clés

**Candidat**
- 🎯 **Score de compatibilité** par secteur (14 métiers), expliqué par l'IA.
- 🤖 **CV et lettre de motivation** adaptés à chaque offre par l'IA, sans aucune invention.
- 🎤 **Simulation d'entretien** à l'écrit ou à la voix, notée par l'IA avec la **méthode STAR**.
- 📋 **Kanban** des candidatures en glisser-déposer, avec relances, notes et statistiques.

**Recruteur**
- ✍️ **Rédaction d'offre assistée par l'IA** à partir de 3 lignes.
- 🧠 **Résumé IA de chaque candidat** : points forts, points à vérifier, questions d'entretien.
- 📅 **Prise de rendez-vous** : créneaux proposés, choix du candidat, export **Google Agenda**.

**Plateforme**
- 🔔 **Notifications en temps réel** (SSE), **Web Push** et **e-mails HTML**.
- 🧹 **Détection des doublons et des offres frauduleuses**, automatisée toutes les 6 h.
- 🔐 **JWT, OAuth2 Google et LinkedIn**, accès par rôle (Candidat, Recruteur, Admin).

---

## 🛠️ Stack

| | |
| :--- | :--- |
| **Frontend** | Angular 18 · Signals · Standalone Components · Angular CDK · SSR · SCSS |
| **Backend** | Java 21 · Spring Boot 3 · Spring Security 6 · JPA / Hibernate · Thymeleaf |
| **Données** | PostgreSQL · Supabase Storage (RLS) |
| **IA** | LLM via Groq API, derrière une abstraction `AiProvider` |
| **Intégrations** | France Travail · Adzuna · Jooble · Google / LinkedIn OAuth2 · Web Push (VAPID) |

---

## 🏛️ Ce que ce projet démontre

| Compétence | Mise en œuvre |
| :--- | :--- |
| **Architecture logicielle** | Modules métier découplés, **Strategy Pattern** (scoring, fournisseur IA), **Adapter Pattern** (sources d'offres) |
| **IA générative en production** | Prompts structurés en JSON, garde-fous anti-hallucination, protection contre le *prompt injection*, quotas et cache |
| **Sécurité** | JWT + OAuth2, contrôle d'accès côté serveur, secrets hors du dépôt, IA de recrutement sans données discriminantes |
| **Temps réel et fiabilité** | Server-Sent Events, Web Push, e-mails envoyés **après le commit** de la transaction |
| **Intégration d'API tierces** | 3 API d'emploi normalisées, imports planifiés (`@Scheduled`) |
| **Front moderne** | Angular Signals, mise à jour optimiste avec retour arrière, interface responsive et accessible |

---



---

<div align="center">


[Portfolio](https://nourstack.netlify.app) · [GitHub](https://github.com/NourLassoued) · [LinkedIn](https://www.linkedin.com/in/lassouednourelhouda)

</div>
