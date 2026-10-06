package jobradarbackend.jobradar.candidate.language;


public enum LanguageLevel {
    A1("A1", "Débutant", "Comprend et utilise des expressions simples du quotidien", 1),
    A2("A2", "Élémentaire", "Communique lors de tâches simples et habituelles", 2),
    B1("B1", "Intermédiaire", "Se débrouille dans la plupart des situations courantes", 3),
    B2("B2", "Avancé", "Communique avec aisance, y compris dans un cadre professionnel", 4),
    C1("C1", "Autonome", "S'exprime couramment et avec précision sur des sujets complexes", 5),
    C2("C2", "Maîtrise", "Comprend et s'exprime sans effort, avec nuance", 6),
    NATIVE("Natif", "Langue maternelle", "Langue parlée depuis l'enfance", 7);

    private final String shortLabel;
    private final String label;
    private final String description;
    private final int rank;

    LanguageLevel(String shortLabel, String label, String description, int rank) {
        this.shortLabel = shortLabel;
        this.label = label;
        this.description = description;
        this.rank = rank;
    }

    public String getShortLabel() { return shortLabel; }
    public String getLabel() { return label; }
    public String getDescription() { return description; }
    public int getRank() { return rank; }
}