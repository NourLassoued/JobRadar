<div align="center">

# 🎯 JobRadar

### Agrégateur d'offres d'emploi multi-sources avec scoring adaptatif par secteur et assistant IA

*Toutes les offres, tous les métiers, classées selon votre profil.*

[![Java](https://img.shields.io/badge/Java-17-orange.svg)](https://www.java.com/)
[![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.4-brightgreen.svg)](https://spring.io/projects/spring-boot)
[![Angular](https://img.shields.io/badge/Angular-18-red.svg)](https://angular.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791.svg)](https://www.postgresql.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Storage-3ECF8E.svg)](https://supabase.com/)
[![Docker](https://img.shields.io/badge/Docker-ready-2496ED.svg)](https://www.docker.com/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

[💼 Portfolio](https://nourstack.netlify.app) · [🐙 GitHub](https://github.com/NourLassoued)

</div>

---

## ⚡ Présentation

**JobRadar** est une plateforme Full Stack qui centralise les offres d'emploi de plusieurs sources publiques, les classe selon le profil du candidat et l'accompagne jusqu'à la candidature.

- **Candidats** : offres agrégées, score de correspondance adapté à leur métier, profil complet (compétences, langues, CV), lettres de motivation générées par IA et suivi des candidatures.
- **Recruteurs** *(prévu)* : publication d'annonces et suivi des candidats.
- **Administrateurs** *(prévu)* : modération, gestion des rôles et pilotage de la plateforme.

---

## 🔥 Fonctionnalités

| | Fonctionnalité | Description | Statut |
| :--: | :--- | :--- | :--: |
| 🔐 | **Authentification** | Email / mot de passe, OAuth2 (Google, LinkedIn), JWT, réinitialisation du mot de passe par email | ✅ |
| 🌐 | **Agrégation multi-API** | France Travail, Adzuna, Jooble, The Muse ([détails](#-sources-doffres--agrégation-multi-api)) | 🔄 |
| 🏷️ | **14 familles de métiers** | Référentiel aligné sur le ROME de France Travail | ✅ |
| 🎯 | **Scoring adaptatif** | Pondération différente selon le métier (Strategy Pattern) | ✅ |
| 👤 | **Profil candidat** | Compétences proposées selon le secteur, langues (niveaux CECRL), CV et photo | ✅ |
| 🤖 | **Assistant IA** | Lettres de motivation et adaptation de CV (Claude API) | 🔄 |
| 📋 | **Suivi des candidatures** | Tableau Kanban à 5 colonnes | 🔄 |
| 📊 | **Tableaux de bord** | Statistiques de recherche et de candidatures | 🔜 |
| 🏢 | **Espace recruteur** | Publication d'offres, suivi des candidats | 🔜 |
| 🛡️ | **Espace administrateur** | Modération, rôles, journal d'audit | 🔜 |
| ☁️ | **Stockage cloud** | CV et photos sur Supabase Storage avec politiques RLS | ✅ |

✅ Livré · 🔄 En cours · 🔜 Prévu

---

## 🌐 Sources d'offres : agrégation multi-API

JobRadar interroge plusieurs API d'emploi, puis ramène toutes les offres dans **un format unique** avant de les classer pour chaque candidat.

| Source | Couverture | Données principales | Authentification | Statut |
| :--- | :--- | :--- | :--- | :--: |
| 🇫🇷 **[France Travail API](https://francetravail.io/)** | France, tous métiers (référentiel ROME) | Intitulé, entreprise, lieu, contrat, salaire, code ROME | OAuth2 *client credentials* | ✅ |
| 🌍 **[Adzuna API](https://developer.adzuna.com/)** | France et une vingtaine de pays | Intitulé, entreprise, lieu, fourchette de salaire, catégorie | `app_id` + `app_key` | 🔄 |
| 🔎 **[Jooble API](https://jooble.org/api/about)** | Agrégateur international, dont la France | Intitulé, entreprise, lieu, salaire, extrait, lien source | Clé API | 🔄 |
| 💼 **[The Muse API](https://www.themuse.com/developers/api/v2)** | Surtout États-Unis, profils tech et business | Intitulé, entreprise, niveau, catégorie, lieu | Clé API (facultative) | 🔄 |

### Fonctionnement

```text
 France Travail ─┐
 Adzuna ─────────┤      ┌──────────────┐    ┌───────────────┐    ┌────────────┐    ┌──────────┐
 Jooble ─────────┼────► │  Adaptateurs │──► │ Normalisation │──► │ Dédoublon- │──► │PostgreSQL│
 The Muse ───────┘      │  par source  │    │  + secteur    │    │   nage     │    │ job_offer│
                        └──────────────┘    └───────────────┘    └────────────┘    └────┬─────┘
                                                                                         │
                                                         Score adaptatif par candidat ◄──┘
```

1. **Un adaptateur par source** : chaque API a son propre client, qui transforme sa réponse en `JobOffer` commun. Ajouter une source revient à écrire un nouvel adaptateur.
2. **Normalisation** : contrat (CDI, CDD, stage…), lieu, salaire annuel brut et rattachement à l'un des 14 secteurs.
3. **Dédoublonnage** : une même offre publiée sur plusieurs sites n'apparaît qu'une fois, avec sa source d'origine conservée.
4. **Synchronisation planifiée** : import régulier via `@Scheduled`, avec gestion des quotas propres à chaque API.

> Les clés d'API ne sont jamais versionnées : elles sont lues depuis les variables d'environnement.

---

## 🏷️ Les 14 familles de métiers

Les secteurs correspondent à l'enum `SectorType`, partagée par le backend et le frontend. Chacun dispose de son référentiel de compétences.

| | Secteur | Code | Exemples de compétences |
| :--: | :--- | :--- | :--- |
| 💻 | Informatique / Tech | `TECH` | Java, Angular, Docker, Kubernetes |
| 🏥 | Santé / Médical | `HEALTH` | Soins infirmiers, Pharmacologie, Gériatrie |
| 🛍️ | Commerce / Vente | `COMMERCE` | Négociation, CRM, Vente B2B |
| 🏗️ | BTP / Construction | `BTP` | Lecture de plans, AutoCAD, BIM |
| 🏨 | Hôtellerie / Restauration | `HOSPITALITY` | Réception, Normes HACCP, Service en salle |
| 🚚 | Transport / Logistique | `TRANSPORT` | Permis C/EC, WMS, Supply Chain |
| 🏭 | Industrie | `INDUSTRY` | Lean Manufacturing, SolidWorks, Contrôle qualité |
| 📢 | Communication | `COMMUNICATION` | SEO, Social media, Relations presse |
| 🌾 | Agriculture | `AGRICULTURE` | Maraîchage, Élevage, Certiphyto |
| 💰 | Banque / Assurance | `BANKING` | Analyse financière, Normes IFRS, KYC |
| 📚 | Éducation / Formation | `EDUCATION` | Pédagogie, E-learning, Ingénierie de formation |
| 🎭 | Arts / Spectacle | `ARTS` | UI/UX Design, Figma, Montage vidéo |
| 👤 | Services à la personne | `PERSONAL_SERVICES` | Aide à domicile, Garde d'enfants |
| 🔧 | Maintenance | `MAINTENANCE` | Diagnostic de panne, Habilitation électrique, GMAO |

---

## 🧠 Scoring adaptatif par secteur

Le score (0 à 100) mesure la correspondance entre un candidat et une offre. **Les critères ne pèsent pas pareil selon le métier** : les diplômes comptent beaucoup pour un infirmier, les compétences techniques pour un développeur.

| Critère | Tech | Santé | Commerce | BTP |
| :--- | :--: | :--: | :--: | :--: |
| Compétences techniques | **40 %** | 15 % | 20 % | 30 % |
| Diplômes / certifications | 10 % | **40 %** | 15 % | 25 % |
| Expérience | 20 % | 25 % | 25 % | 25 % |
| Savoir-être | 5 % | 5 % | **30 %** | 5 % |

Mis en œuvre avec le **Strategy Pattern** (`SectorTemplate`) : chaque secteur a sa propre stratégie de pondération, et ajouter un secteur ne modifie pas le moteur existant.

```text
Profil candidat (secteur, compétences, langues, expérience)
                    │
                    ▼
     ┌─────────────────────────────┐
     │  SectorTemplate du métier   │  ← stratégie choisie selon le secteur de l'offre
     └──────────────┬──────────────┘
                    ▼
    Offre d'emploi ─► Score 0-100 ─► Offres triées par pertinence
```

---

## 🏗️ Architecture

```text
                      ┌───────────────────────────────┐
                      │          Angular 18           │
                      │  Standalone · Signals · SSR   │
                      └───────────────┬───────────────┘
                                      │ REST + JWT
                      ┌───────────────▼───────────────┐
                      │        Spring Boot 3.4        │
                      │  Spring Security 6 · OAuth2   │
                      │  Auth · Offres · Profil · IA  │
                      └──────┬────────┬────────┬──────┘
                             │        │        │
            ┌────────────────┘        │        └─────────────────┐
            ▼                         ▼                          ▼
   ┌─────────────────┐       ┌─────────────────┐       ┌───────────────────┐
   │   PostgreSQL    │       │    Supabase     │       │   API externes    │
   │ Candidats,      │       │ Storage (CV,    │       │ • France Travail  │
   │ offres, langues │       │ photos) + RLS   │       │ • Adzuna · Jooble │
   └─────────────────┘       └─────────────────┘       │ • The Muse        │
                                                       │ • Claude API      │
                                                       └───────────────────┘
```

---

## 🧰 Stack technique

| Couche | Technologies |
| :--- | :--- |
| **Frontend** | Angular 18 (standalone, Signals, Reactive Forms, SSR), SCSS, Tabler Icons |
| **Backend** | Spring Boot 3.4, Java 17, Spring Security 6, JWT, OAuth2 (Google, LinkedIn), Spring Mail, Thymeleaf |
| **Données** | PostgreSQL 16, Spring Data JPA / Hibernate |
| **Stockage** | Supabase Storage (CV, photos) avec politiques RLS |
| **Offres** | France Travail API, Adzuna API, Jooble API, The Muse API |
| **IA** | Claude API (analyse de CV, lettres de motivation) |
| **DevOps** | Docker, GitHub Actions, Maven |
