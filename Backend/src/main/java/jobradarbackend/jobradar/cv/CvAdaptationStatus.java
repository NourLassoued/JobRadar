package jobradarbackend.jobradar.cv;

public enum CvAdaptationStatus {
    /** Générée, pas encore relue par le candidat */
    DRAFT,
    /** Acceptée : le candidat l'utilise pour postuler */
    ACCEPTED,
    /** Rejetée par le candidat */
    REJECTED
}