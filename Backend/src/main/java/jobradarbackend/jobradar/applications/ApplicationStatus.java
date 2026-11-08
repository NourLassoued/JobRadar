package jobradarbackend.jobradar.applications;

/** Étapes d'une candidature = colonnes du Kanban, dans l'ordre d'affichage */
public enum ApplicationStatus {
    /** Offre sauvegardée, pas encore envoyée */
    TO_APPLY,
    /** Applied : candidature envoyée */
    APPLIED,
    /** Under review : candidature en cours d'examen */
    UNDER_REVIEW,
    /** Interview : entretien prévu ou passé */
    INTERVIEW,
    /** Assessment : test technique ou évaluation */
    ASSESSMENT,
    /** Offer : proposition reçue */
    OFFER,
    /** Embauche confirmée par le recruteur (affichée dans la colonne Offer) */
    HIRED,
    /** Rejected : refus de l'entreprise */
    REJECTED,
    /** Withdrawn : le candidat a retiré sa candidature */
    WITHDRAWN
}