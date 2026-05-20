package jobradarbackend.jobradar.candidate;


public enum SectorType {

    // Format : enum(libellé, motCléFranceTravail)
    TECH("Informatique / Tech", "informatique"),
    HEALTH("Santé / Médical", "infirmier"),
            COMMERCE("Commerce / Vente", "commercial"),
    BTP("BTP / Construction", "chantier"),
    HOSPITALITY("Hôtellerie / Restauration", "restauration"),
    TRANSPORT("Transport / Logistique", "logistique"),
    INDUSTRY("Industrie", "production"),
    COMMUNICATION("Communication", "communication"),
    AGRICULTURE("Agriculture", "agricole"),
    BANKING("Banque / Assurance", "banque"),
    EDUCATION("Éducation / Formation", "formateur"),
            ARTS("Arts / Spectacle", "artistique"),
    PERSONAL_SERVICES("Services à la personne", "service"),
    MAINTENANCE("Maintenance", "maintenance"),
    OTHER("Autre", null);

    private final String displayName;
    private final String searchKeyword;

    SectorType(String displayName, String searchKeyword) {
        this.displayName = displayName;
        this.searchKeyword = searchKeyword;
    }

    public String getDisplayName() {
        return displayName;
    }

    public String getSearchKeyword() {
        return searchKeyword;
    }


    public boolean isImportable() {
        return searchKeyword != null;
    }
}