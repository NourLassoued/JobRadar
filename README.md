<div align="center">

# 🎯 JobRadar

## Intelligent Job Aggregator & Career Assistant

**Centralisez les offres d'emploi, personnalisez votre recherche et suivez vos candidatures dans une seule plateforme.**

**Full Stack Java / Angular · AI · PostgreSQL · Supabase · Docker**

</div>

---

## ⚡ Présentation

**JobRadar** est une plateforme Full Stack permettant aux candidats de :

* 🔎 rechercher et centraliser des offres d'emploi
* 🎯 obtenir un score personnalisé selon leur profil
* 🤖 utiliser l'IA pour générer des lettres de motivation et des conseils
* 📄 gérer leur profil, CV et lien LinkedIn
* 📊 suivre leurs candidatures avec un tableau Kanban

Les offres sont intégrées depuis l'**API France Travail** et peuvent être analysées selon le secteur et le profil du candidat.

---

## 🔥 Fonctionnalités principales

| Fonctionnalité      | Description                                     |
| ------------------- | ----------------------------------------------- |
| 🔐 Authentification | Email/password + OAuth2 Google/LinkedIn         |
| 👤 Profil candidat  | Informations personnelles, secteur, expérience  |
| 📄 Gestion du CV    | Upload, remplacement et suppression du CV       |
| 🔗 LinkedIn         | Validation et gestion du profil LinkedIn        |
| 🖼️ Photo de profil | Upload et gestion sécurisée                     |
| 🔎 Job Aggregation  | Import d'offres via France Travail API          |
| 🧠 Job Matching     | Score personnalisé selon le profil              |
| 🤖 AI Assistant     | Lettres de motivation et conseils personnalisés |
| 📊 Dashboard        | Vue centralisée des offres pertinentes          |
| 📋 Kanban           | Suivi des candidatures                          |
| ☁️ Cloud Storage    | Supabase Storage avec politiques RLS            |

---

## 🧠 Scoring personnalisé

JobRadar ne se limite pas à rechercher des mots-clés.

Le système peut adapter la pondération des critères selon le **secteur professionnel**.

Exemple :

| Critère     | Tech | Santé | Commerce | BTP |
| ----------- | :--: | :---: | :------: | :-: |
| Compétences |  40% |  15%  |    20%   | 30% |
| Diplômes    |  10% |  40%  |    15%   | 25% |
| Expérience  |  20% |  25%  |    25%   | 25% |
| Soft skills |  5%  |   5%  |    30%   |  5% |

### Architecture

Le scoring est conçu autour du **Strategy Pattern**, permettant d'ajouter ou de modifier les règles de scoring par secteur sans modifier le cœur de l'application.

---

## 🤖 Intelligence artificielle

L'intégration IA permet notamment de :

* analyser les informations du candidat
* exploiter les informations d'une offre
* générer une lettre de motivation adaptée
* proposer des conseils liés à l'offre
* faciliter la personnalisation des candidatures

**Technologie : Claude API**

---

## ☁️ Supabase Storage

Les fichiers utilisateurs sont stockés avec **Supabase Storage**.

### Profile images

* Bucket : `profiles`
* Formats : JPEG, PNG, GIF, WebP
* Taille maximale : 5 MB
* Accès protégé par RLS

### CV

* Bucket : `cvs`
* Formats : PDF, DOC, DOCX, TXT
* Taille maximale : 10 MB
* Accès protégé par RLS

### Upload Flow

```text
Angular
   │
   │ HTTP
   ▼
Spring Boot
   │
   ├──────────────► Supabase Storage
   │                      │
   │                      ▼
   │                 File stored
   │
   ▼
PostgreSQL
   │
   └── File metadata / URL
```

Lorsqu'un utilisateur remplace son fichier, l'ancien fichier peut être supprimé afin d'éviter les fichiers obsolètes dans le Storage.

---

## 🛠️ Tech Stack

| Couche           | Technologies                                                      |
| ---------------- | ----------------------------------------------------------------- |
| **Frontend**     | Angular 18 · TypeScript · Signals · Reactive Forms · Tailwind CSS |
| **Backend**      | Java 21 · Spring Boot 3.4 · Spring Security 6                     |
| **API**          | REST API · JWT · OAuth2                                           |
| **Database**     | PostgreSQL 16 · JPA · Hibernate                                   |
| **Storage**      | Supabase Storage · RLS                                            |
| **AI**           | Claude API                                                        |
| **External API** | France Travail API                                                |
| **DevOps**       | Docker · GitHub Actions                                           |
| **Testing**      | JUnit · Mockito                                                   |
| **Code Quality** | SonarQube · JaCoCo                                                |

---

## 🔐 Security

La sécurité de l'application repose notamment sur :

* JWT Authentication
* BCrypt password hashing
* Spring Security
* OAuth2 Google
* OAuth2 LinkedIn
* CORS configuration
* Server-side validation
* Input validation
* Supabase Row Level Security (RLS)
* Protected API endpoints

L'objectif est de garantir que les données et fichiers d'un candidat restent accessibles selon les règles d'autorisation définies par l'application.

---

## 🏗️ Architecture

```text
                         ┌──────────────────────┐
                         │      Angular 18      │
                         │  Signals + Tailwind  │
                         └──────────┬───────────┘
                                    │
                              REST + JWT
                                    │
                         ┌──────────▼───────────┐
                         │     Spring Boot      │
                         │       Java 21        │
                         │   Spring Security    │
                         └───────┬───────┬──────┘
                                 │       │
                    ┌────────────▼─┐   ┌─▼─────────────┐
                    │  PostgreSQL  │   │    Supabase   │
                    │   Database   │   │    Storage    │
                    └─────────────┘   └───────────────┘
                                 │
                         ┌───────▼────────┐
                         │ External APIs   │
                         │ France Travail  │
                         │ Google / LinkedIn│
                         │ Claude API      │
                         └─────────────────┘
```

---

## 👤 ProfileComponent

Le `ProfileComponent` permet au candidat de gérer son profil depuis une interface responsive.

### Fonctionnalités

* Informations personnelles
* Secteur professionnel
* Années d'expérience
* Photo de profil
* CV
* LinkedIn URL
* Validation des champs
* Messages d'erreur courts
* Responsive design
* Reactive Forms
* Angular Signals

### Custom Validators

Des validateurs personnalisés sont utilisés notamment pour :

* validation du CV
* validation de l'URL LinkedIn
* validation des champs utilisateur

---

## 📋 Application Workflow

### 1. Création du profil

```text
Nom + Prénom
      ↓
Email
      ↓
Secteur professionnel
      ↓
Expérience
      ↓
LinkedIn
      ↓
Photo + CV
```

### 2. Recherche d'emploi

```text
France Travail API
        ↓
Import des offres
        ↓
Normalisation des données
        ↓
Stockage PostgreSQL
```

### 3. Matching

```text
Profil candidat
      +
Offre d'emploi
      ↓
Scoring personnalisé
      ↓
Score de compatibilité
```

### 4. Candidature

```text
Offre
 ↓
Analyse
 ↓
Lettre de motivation IA
 ↓
Candidature
 ↓
Kanban Tracker
```

---

## 📊 Dashboard

Le dashboard permet de centraliser :

* les offres disponibles
* les offres correspondant au profil
* les scores de matching
* les candidatures
* l'état d'avancement des candidatures

### Kanban

```text
┌───────────┐   ┌───────────┐   ┌────────────┐   ┌────────────┐
│ À faire   │ → │ En cours  │ → │ Entretien  │ → │ Décision   │
└───────────┘   └───────────┘   └────────────┘   └────────────┘
```

---

## 📁 Project Structure

```text
JobRadar/
│
├── backend/
│   ├── controller/
│   ├── service/
│   ├── repository/
│   ├── entity/
│   ├── dto/
│   ├── security/
│   └── config/
│
├── frontend/
│   └── src/
│       └── app/
│           ├── core/
│           ├── features/
│           ├── shared/
│           └── services/
│
├── database/
│   └── migrations/
│
└── documentation/
```

---

## 📚 Documentation

Documentation complémentaire disponible dans le projet :

* `README-JobRadar-RECRUITER-FRIENDLY.md` — présentation orientée recruteurs
* `README-JobRadar-UPDATED.md` — documentation technique
* `ULTRA-PROFESSIONAL-INTEGRATION-GUIDE.md` — guide d'intégration
* Documentation API et configuration

---

## 📈 Project Status

| Feature                    | Status        |
| -------------------------- | ------------- |
| Authentication             | ✅ Implemented |
| OAuth2 Google              | ✅ Implemented |
| OAuth2 LinkedIn            | ✅ Implemented |
| Candidate Profile          | ✅ Implemented |
| CV Upload                  | ✅ Implemented |
| Profile Image Upload       | ✅ Implemented |
| LinkedIn Validation        | ✅ Implemented |
| France Travail Integration | ✅ Implemented |
| Job Matching               | ✅ Implemented |
| AI Integration             | ✅ Implemented |
| Supabase Storage           | ✅ Implemented |
| RLS Policies               | ✅ Implemented |
| Dashboard                  | ✅ Implemented |
| Application Tracker        | ✅ Implemented |
| Notifications              | 🔄 Planned    |
| Multi-CV                   | 🔄 Planned    |

---

## 📱 Responsive Design

L'interface est conçue pour différents formats d'écran :

* 📱 Mobile
* 📱 Tablet
* 💻 Desktop

Le frontend utilise une approche responsive avec Angular et Tailwind CSS.

---

## 🎯 Skills Demonstrated

Ce projet met en pratique plusieurs compétences Full Stack :

| Domaine             | Compétences                                       |
| ------------------- | ------------------------------------------------- |
| **Backend**         | Java 21 · Spring Boot · REST API                  |
| **Security**        | JWT · OAuth2 · Spring Security                    |
| **Frontend**        | Angular · TypeScript · Signals                    |
| **Database**        | PostgreSQL · JPA · Hibernate                      |
| **Cloud**           | Supabase Storage · RLS                            |
| **AI**              | Claude API                                        |
| **Architecture**    | Strategy Pattern · séparation des responsabilités |
| **DevOps**          | Docker · GitHub Actions                           |
| **Testing**         | JUnit · Mockito                                   |
| **API Integration** | France Travail · OAuth2 providers                 |

---

## 🚀 Installation

### Backend

```bash
cd backend
./mvnw spring-boot:run
```

### Frontend

```bash
cd frontend
npm install
ng serve
```

L'application sera ensuite accessible localement depuis le navigateur.

> Les variables d'environnement et les credentials nécessaires aux services externes doivent être configurés avant le démarrage.

---

## 👩‍💻 Auteur

### Nour Lassoued

**Full Stack Java / Angular Developer**

Java · Spring Boot · Angular · PostgreSQL · Docker · Cloud · AI

🌐 Portfolio : [nourstack.netlify.app](https://nourstack.netlify.app)

💻 GitHub : [NourLassoued](https://github.com/NourLassoued)

---

<div align="center">

### 🚀 JobRadar

**Build. Match. Apply.**

</div>
