package jobradarbackend.jobradar.ai.explain;

import jakarta.validation.constraints.NotNull;

import java.util.List;

/** Explication IA du score de compatibilité */
public final class ScoreExplanationDtos {

    private ScoreExplanationDtos() {
    }

    public record ExplainRequest(@NotNull Long jobOfferId) {}

    /** Une action concrète pour améliorer le score ou la candidature */
    public record Action(String title, String detail) {}

    /**
     * @param score          score actuel (calculé par le moteur de matching, pas par l'IA)
     * @param potentialScore score si le candidat maîtrisait toutes les technologies de l'offre (null si déjà au maximum)
     * @param summary        2 ou 3 phrases : pourquoi ce score
     * @param strengths      points forts réels du profil pour cette offre
     * @param gaps           ce qui fait baisser le score
     * @param actions        3 actions concrètes et honnêtes
     * @param cached         true si l'explication vient du cache (aucune génération consommée)
     */
    public record ScoreExplanation(
            Long jobOfferId,
            int score,
            Integer potentialScore,
            String summary,
            List<String> strengths,
            List<String> gaps,
            List<Action> actions,
            String aiModel,
            boolean cached,
            Integer remainingQuota) {}
}
