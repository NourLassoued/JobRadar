package jobradarbackend.jobradar.ai.interview;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jobradarbackend.jobradar.ai.AiDtos;

import java.util.List;

public final class InterviewDtos {

    private InterviewDtos() {
    }

    public enum Category {
        /** Compétence technique demandée par l'offre et présente dans le profil */
        TECHNICAL,
        /** « Parlez-moi de votre expérience chez… », projets, réalisations */
        EXPERIENCE,
        /** Mises en situation, travail en équipe, gestion de conflit (méthode STAR) */
        BEHAVIORAL,
        /** Pourquoi ce poste, cette entreprise, ce secteur */
        MOTIVATION,
        /** Compétence demandée par l'offre mais absente du profil : réponse honnête à préparer */
        GAP
    }


    public record InterviewPrepRequest(
            @NotNull Long jobOfferId,
            Long cvId,
            AiDtos.Language language,
            @Min(5) @Max(12) Integer questionCount) {}

    public record InterviewQuestion(
            Category category,
            String question,
            String why,
            String suggestedAnswer,
            List<String> keyPoints,
            String relatedSkill) {}


    public record InterviewPrepResponse(
            Long jobOfferId,
            String offerTitle,
            String offerCompany,
            Integer matchScore,
            List<String> matchedSkills,
            List<String> missingSkills,
            List<InterviewQuestion> questions,
            List<String> questionsToAsk,
            List<String> tips,
            String aiModel,
            Integer remainingQuota) {}
}