package jobradarbackend.jobradar.ai.interview;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import jobradarbackend.jobradar.ai.AiDtos;

import java.util.List;

/** Simulation d'entretien : le candidat répond, l'IA évalue la réponse */
public final class InterviewPracticeDtos {

    private InterviewPracticeDtos() {
    }

    /**
     * @param spoken true si la réponse a été dictée au micro (ponctuation imparfaite : pas pénalisée)
     */
    public record AnswerRequest(
            @NotNull Long jobOfferId,
            InterviewDtos.Category category,
            @NotBlank @Size(max = 600) String question,
            @NotBlank @Size(min = 15, max = 5000) String answer,
            AiDtos.Language language,
            Boolean spoken) {}

    /** Une étape de la méthode STAR : présente ou non dans la réponse, avec un commentaire */
    public record StarStep(boolean present, String comment) {}

    public record Star(StarStep situation, StarStep task, StarStep action, StarStep result) {}

    /**
     * @param score           note de 0 à 10
     * @param verdict         une phrase de bilan
     * @param improvedAnswer  la même réponse, mieux structurée, sans fait inventé
     */
    public record AnswerFeedback(
            int score,
            String verdict,
            Star star,
            List<String> strengths,
            List<String> improvements,
            String improvedAnswer,
            String aiModel,
            Integer remainingQuota) {}
}
