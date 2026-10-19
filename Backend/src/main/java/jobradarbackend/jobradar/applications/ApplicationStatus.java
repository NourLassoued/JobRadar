package jobradarbackend.jobradar.applications;

/** Étapes d'une candidature = colonnes du Kanban, dans l'ordre d'affichage */
public enum ApplicationStatus {
    /** Offre sauvegardée, pas encore envoyée */
    TO_APPLY,
    /** Candidature envoyée */
    APPLIED,
    /** Entretien prévu ou passé */
    INTERVIEW,
    /** Proposition reçue */
    OFFER,
    /** Refus de l'entreprise */
    REJECTED,
    /** Le candidat a abandonné */
    WITHDRAWN
}