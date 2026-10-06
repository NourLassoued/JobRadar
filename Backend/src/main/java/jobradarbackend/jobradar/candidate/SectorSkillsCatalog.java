package jobradarbackend.jobradar.candidate;

import org.springframework.stereotype.Component;

import java.util.*;
import java.util.stream.Collectors;
import java.util.stream.Stream;


@Component
public class SectorSkillsCatalog {

    // ── Listes de base (reprises de l'ancien contrôleur) ──────────────────

    private static final List<String> TECH = List.of(
            "Java", "Python", "JavaScript", "TypeScript", "Angular", "React", "Vue.js",
            "Spring Boot", "Node.js", "Express.js", "Django", "FastAPI",
            "Docker", "Kubernetes", "Git", "GitHub Actions", "SQL", "PostgreSQL",
            "MySQL", "MongoDB", "Redis", "REST API", "GraphQL", "CI/CD",
            "AWS", "Azure", "GCP", "DevOps", "Linux", "Terraform",
            "Microservices", "Cybersécurité", "Machine Learning", "Data Analysis",
            "Agile / Scrum");

    private static final List<String> HEALTH = List.of(
            "Diagnostic médical", "Soins infirmiers", "Pharmacologie", "Radiologie",
            "Chirurgie", "Anesthésie", "Santé mentale", "Gestion de patient",
            "Premiers secours", "EHPAD", "Stérilisation", "Prévention",
            "Traçabilité", "Réglementation sanitaire", "Télémédecine",
            "Ergonomie médicale", "Suivi des dossiers médicaux (DPI)",
            "Hygiène hospitalière", "Pédiatrie", "Gériatrie");

    private static final List<String> BTP = List.of(
            "Maçonnerie", "Charpente", "Plomberie", "Électricité", "Carrelage",
            "Peinture", "Menuiserie", "Gros œuvre", "Finitions",
            "Sécurité du chantier (HSE)", "Lecture de plans", "Devis",
            "Gestion de projet", "AutoCAD", "BIM (Revit)", "Étude de prix",
            "Topographie", "Isolation thermique", "Génie civil");

    private static final List<String> COMMERCE = List.of(
            "Vente", "Relation client", "Merchandising", "Gestion de caisse",
            "Négociation", "Fidélisation", "Multicanal", "E-commerce",
            "Gestion de stock", "Visual merchandising", "CRM",
            "Prospection commerciale", "Gestion du point de vente",
            "Cross-selling / Up-selling", "Gestion des réclamations");

    private static final List<String> SALES = List.of(
            "Vente B2B", "Vente B2C", "Prospection téléphonique / Cold Email", "Négociation",
            "Closing", "CRM (Salesforce, HubSpot)", "Présentation client", "Fidélisation",
            "Territory management", "Forecasting", "Social selling (LinkedIn)",
            "Key Account Management");

    private static final List<String> TRANSPORT = List.of(
            "Permis poids lourd (C/EC)", "Permis marchandises", "Sécurité routière",
            "Tachygraphe", "Navigation GPS", "Chargement/déchargement",
            "Mécanique véhicule", "Respect des délais", "Itinéraires",
            "Transport de matières dangereuses (ADR)", "Conduite éco-responsable",
            "Gestion de flotte");

    private static final List<String> LOGISTICS = List.of(
            "Gestion de stock", "Préparation de commandes", "Manutention",
            "Optimisation d'itinéraires", "TMS (Transport Management System)",
            "WMS (Warehouse Management System)", "Emballage", "Traçabilité", "Douane",
            "Incoterms", "CACES (Conduite d'engins)", "Supply Chain", "Inventaire");

    private static final List<String> HOTEL = List.of(
            "Accueil", "Réception", "Housekeeping", "Room service",
            "Gestion de réservation", "Service client", "Sommellerie", "Protocole",
            "Langues étrangères", "PMS (Opera, Cloudbeds)",
            "Yield Management / Revenue Management", "Check-in / Check-out");

    private static final List<String> RESTAURATION = List.of(
            "Service en salle", "Cuisine", "Plonge", "Normes HACCP", "Bar / Mixologie",
            "Gestion des fiches techniques", "Gestion des stocks alimentaires",
            "Dressage des assiettes", "Prise de commande");

    private static final List<String> TOURISM = List.of(
            "Guide touristique", "Conception de séjours", "Animation", "Gestion de groupe",
            "Booking / Réservation", "E-tourisme");

    private static final List<String> INDUSTRY = List.of(
            "Conception mécanique", "Génie électrique", "Automatisme", "SolidWorks / CATIA",
            "Gestion de projet industriel", "Dimensionnement", "Gestion de la qualité (ISO 9001)",
            "R&D", "Lean Manufacturing", "Six Sigma", "Conduite de ligne de production",
            "Contrôle qualité", "Lecture de plans techniques", "Sécurité industrielle");

    private static final List<String> COMMUNICATION = List.of(
            "Marketing digital", "SEO", "SEM / Google Ads", "Social media", "Content marketing",
            "Email marketing", "Google Analytics", "Branding", "Marketing automation",
            "Copywriting", "Relations presse", "Communication interne", "Inbound marketing",
            "Étude de marché", "A/B Testing", "Adobe Creative Suite");

    private static final List<String> BANKING = List.of(
            "Comptabilité générale", "Comptabilité analytique", "Audit", "Consolidation",
            "Trésorerie", "Reporting", "Normes IFRS", "Excel avancé",
            "Fiscalité", "Contrôle de gestion", "Analyse financière", "Gestion des risques",
            "Modélisation financière", "Conseil clientèle bancaire", "Crédit",
            "Assurance (IARD, vie)", "Conformité (KYC, LCB-FT)");

    private static final List<String> EDUCATION = List.of(
            "Pédagogie", "Enseignement", "Préparation de cours", "Évaluation",
            "Gestion de classe", "Accompagnement individuel", "Didactique",
            "Orientation", "Relation parents", "LMS (Canvas, Moodle)",
            "Inclusion scolaire (EBEP)", "E-learning", "Création de supports pédagogiques",
            "Ingénierie de formation", "Animation de formation");

    private static final List<String> ARTS = List.of(
            "UI Design", "UX Design", "Figma", "Photoshop", "Illustrator", "InDesign",
            "Motion Design", "Design System", "Wireframing", "Prototypage",
            "Photographie", "Montage vidéo (Premiere, DaVinci)", "Régie son et lumière",
            "Scénographie", "Interprétation scénique", "Production de spectacles");

    private static final List<String> AGRICULTURE = List.of(
            "Conduite d'engins agricoles", "Cultures céréalières", "Maraîchage", "Arboriculture",
            "Élevage", "Soins aux animaux", "Irrigation", "Agriculture biologique",
            "Traitements phytosanitaires (Certiphyto)", "Viticulture", "Récolte",
            "Gestion d'exploitation", "Entretien du matériel agricole");

    private static final List<String> PERSONAL_SERVICES = List.of(
            "Aide à domicile", "Accompagnement des personnes âgées", "Garde d'enfants",
            "Aide aux repas", "Entretien du logement", "Aide à la toilette",
            "Accompagnement du handicap", "Écoute et bienveillance", "Premiers secours (PSC1)",
            "Gestion des courses", "Assistance administrative", "Animation d'activités");

    private static final List<String> MAINTENANCE = List.of(
            "Maintenance préventive", "Maintenance corrective", "Diagnostic de panne",
            "Électrotechnique", "Mécanique industrielle", "Hydraulique", "Pneumatique",
            "Habilitation électrique", "Lecture de schémas", "GMAO",
            "Soudure", "Climatisation / CVC", "Automates programmables");

    private static final List<String> OTHER = List.of(
            "Communication", "Travail d'équipe", "Résolution de problèmes",
            "Adaptabilité", "Leadership", "Gestion du temps", "Pensée critique", "Créativité",
            "Pack Office (Word, Excel, PowerPoint)", "Gestion administrative", "Accueil");

    // ── Catalogue final, indexé par l'enum ─────────────────────────────────

    private final Map<SectorType, List<String>> skills = new EnumMap<>(SectorType.class);

    public SectorSkillsCatalog() {
        put(SectorType.TECH, TECH);
        put(SectorType.HEALTH, HEALTH);
        put(SectorType.COMMERCE, COMMERCE, SALES);
        put(SectorType.BTP, BTP);
        put(SectorType.HOSPITALITY, HOTEL, RESTAURATION, TOURISM);
        put(SectorType.TRANSPORT, TRANSPORT, LOGISTICS);
        put(SectorType.INDUSTRY, INDUSTRY);
        put(SectorType.COMMUNICATION, COMMUNICATION);
        put(SectorType.AGRICULTURE, AGRICULTURE);
        put(SectorType.BANKING, BANKING);
        put(SectorType.EDUCATION, EDUCATION);
        put(SectorType.ARTS, ARTS);
        put(SectorType.PERSONAL_SERVICES, PERSONAL_SERVICES);
        put(SectorType.MAINTENANCE, MAINTENANCE);
        put(SectorType.OTHER, OTHER);
    }

    /** Fusionne plusieurs listes en supprimant les doublons, dans l'ordre */
    @SafeVarargs
    private void put(SectorType sector, List<String>... lists) {
        List<String> merged = Stream.of(lists)
                .flatMap(List::stream)
                .collect(Collectors.toCollection(LinkedHashSet::new))
                .stream()
                .toList();
        skills.put(sector, merged);
    }

    public List<String> skillsFor(SectorType sector) {
        return skills.getOrDefault(sector, List.of());
    }

    public Map<SectorType, List<String>> all() {
        return Collections.unmodifiableMap(skills);
    }

    /** Vrai si la compétence fait partie du secteur (sans tenir compte des majuscules) */
    public boolean contains(SectorType sector, String skill) {
        return skillsFor(sector).stream().anyMatch(s -> s.equalsIgnoreCase(skill.trim()));
    }
}