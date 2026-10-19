package jobradarbackend.jobradar.ai;

import jakarta.validation.constraints.NotNull;
import jobradarbackend.jobradar.cv.CvAdaptation;
import jobradarbackend.jobradar.cv.CvAdaptationStatus;

import java.time.LocalDateTime;
import java.util.List;

/** Objets échangés avec le front pour les fonctions IA */
public final class AiDtos {

    private AiDtos() {
    }

    // ── Adaptation de CV ─────────────────────────────────────

    /** cvId facultatif : CV par défaut si absent */
    public record AdaptCvRequest(@NotNull Long jobOfferId, Long cvId) {}

    public record UpdateStatusRequest(@NotNull CvAdaptationStatus status) {}

    public record CvAdaptationResponse(
            Long id, Long cvId, String cvTitle, Long jobOfferId,
            String adaptedContent, List<String> keywordsAdded, List<String> suggestions,
            /** Technologies présentes dans le CV adapté mais absentes du CV d'origine : à vérifier */
            List<String> unverifiedSkills,
            Integer scoreBefore, Integer scoreAfter,
            String aiModel, CvAdaptationStatus status, LocalDateTime createdAt,
            Integer remainingQuota) {

        public static CvAdaptationResponse from(CvAdaptation a, List<String> unverified, Integer remaining) {
            return new CvAdaptationResponse(a.getId(), a.getCv().getId(), a.getCv().getTitle(), a.getJobOffer().getId(),
                    a.getAdaptedContent(), a.getKeywordsAdded(), a.getSuggestions(), unverified,
                    a.getScoreBefore(), a.getScoreAfter(), a.getAiModel(), a.getStatus(), a.getCreatedAt(), remaining);
        }
    }

    // ── Lettre de motivation ─────────────────────────────────

    public enum Tone { FORMAL, DYNAMIC }
    public enum Length { SHORT, STANDARD }
    public enum Language { FR, EN }

    public record CoverLetterRequest(@NotNull Long jobOfferId, Long cvId, Tone tone, Length length, Language language) {}

    public record CoverLetterResponse(String subject, String letter, List<String> highlights,
                                      String aiModel, Integer remainingQuota) {}

    // ── Quota ────────────────────────────────────────────────

    public record QuotaResponse(int limit, int used, int remaining) {}
}