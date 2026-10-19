package jobradarbackend.jobradar.matching;


public record MatchingWeights(double skills, double experience, double sector) {

    public MatchingWeights {
        if (skills < 0 || experience < 0 || sector < 0) {
            throw new IllegalArgumentException("Les pondérations doivent être positives.");
        }
        double sum = skills + experience + sector;
        if (Math.abs(sum - 1.0) > 0.0001) {
            throw new IllegalArgumentException("La somme des pondérations doit valoir 1 (actuellement " + sum + ").");
        }
    }
}