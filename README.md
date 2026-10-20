<div align="center">

# 🎯 JobRadar

### Agrégateur d'offres d'emploi multi-sources avec scoring adaptatif par secteur et assistant IA

[![Java](https://img.shields.io/badge/Java-17-orange.svg)](https://www.java.com/)
[![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.4-brightgreen.svg)](https://spring.io/projects/spring-boot)
[![Angular](https://img.shields.io/badge/Angular-18-red.svg)](https://angular.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791.svg)](https://www.postgresql.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Storage-3ECF8E.svg)](https://supabase.com/)
[![Groq](https://img.shields.io/badge/IA-Groq%20API-F55036.svg)](https://console.groq.com/)
[![Docker](https://img.shields.io/badge/Docker-ready-2496ED.svg)](https://www.docker.com/)


</div>

---

## ⚡ En bref

**JobRadar** est une application Full Stack qui centralise les offres d'emploi issues de plusieurs API (**France Travail, Adzuna, Jooble, The Muse**).

Elle élimine les doublons, ramène les offres à un format standardisé et les classe grâce à un moteur de scoring personnalisé selon le secteur métier. L'application intègre également un **assistant IA** pour adapter les CV et générer des lettres de motivation sur mesure.

---

## 🔑 Fonctionnalités clés

- 🔐 **Auth & Sécurité** : JWT, OAuth2 (Google, LinkedIn), réinitialisation sécurisée du mot de passe par email.
- 🌐 **Agrégation multi-API** : normalisation et dédoublonnage automatiques des offres multi-sources (`@Scheduled`).
- 🎯 **Scoring adaptatif** *(Strategy Pattern)* : pondération sur mesure selon 14 secteurs métiers (ex. : focus technique pour la Tech, diplômes pour la Santé).
- 🤖 **Assistant IA** *(Groq API)* :
  - adaptation de CV avec garde-fous anti-invention ;
  - génération personnalisée de lettres de motivation (ton, langue, format).
- ☁️ **Stockage cloud** : gestion sécurisée des CV et photos via Supabase Storage et règles RLS.
- 📋 **Suivi des candidatures** : tableau Kanban dynamique pour suivre chaque postulation.

---

## 🛠️ Stack technique

| Couche | Technologies |
| :--- | :--- |
| **Frontend** | Angular 18 (Standalone, Signals, Reactive Forms, SSR), SCSS |
| **Backend** | Spring Boot 3.4, Java 17, Spring Security 6, JWT, OAuth2, Thymeleaf |
| **Données & Cloud** | PostgreSQL 16, Spring Data JPA, Supabase Storage (RLS) |
| **IA & API** | Groq API (`openai/gpt-oss-120b`), France Travail, Adzuna, Jooble, The Muse |
| **DevOps** | Docker, GitHub Actions, Maven |

---

## 🏛️ Points forts de l'architecture

**Clean Architecture & Design Patterns**

- **Adapter Pattern** : intégration modulaire et indépendante de chaque source d'emploi.
- **Strategy Pattern** : découplage de la logique de scoring métier et isolation du fournisseur IA (`AiProvider`).

**Performance & Robustesse**

- Gestion stricte des quotas API et IA (quota journalier par utilisateur, remboursé en cas d'échec).
- Angular Signals pour une gestion d'état réactive et performante.

```text
 France Travail ─┐
 Adzuna ─────────┤     ┌─────────────┐    ┌───────────────┐    ┌──────────────┐    ┌────────────┐
 Jooble ─────────┼───► │ Adaptateurs │──► │ Normalisation │──► │ Dédoublonnage│──► │ PostgreSQL │
 The Muse ───────┘     └─────────────┘    └───────────────┘    └──────────────┘    └─────┬──────┘
                                                                                         │
                         Angular 18 ◄── REST + JWT ── Spring Boot ◄── Score par secteur ◄┘
                                                          │
                                                          └──► AiProvider ──► Groq API
```
