package jobradarbackend.jobradar.ai.recruiter;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import jobradarbackend.jobradar.candidate.SectorType;

import java.util.List;

/** Fonctions IA de l'espace recruteur */
public final class RecruiterAiDtos {

    private RecruiterAiDtos() {
    }

    // ── 8. Résumé IA d'un candidat ────────────────────────────

    /** Une question à poser en entretien, et ce qu'elle permet de vérifier */
    public record InterviewQuestion(String question, String purpose) {}

    /**
     * @param summary    2 phrases sur l'adéquation du profil au poste
     * @param strengths  3 points forts tirés du CV et du profil
     * @param watchPoint 1 point de vigilance à vérifier en entretien (jamais une raison de rejeter)
     * @param questions  questions à poser, construites à partir du CV
     * @param cvUsed     false si le CV n'a pas pu être lu (résumé fait sur le profil seul)
     * @param cached     true si le résumé vient du cache (aucune génération consommée)
     */
    public record ApplicantInsight(
            Long applicationId,
            String summary,
            List<String> strengths,
            String watchPoint,
            List<InterviewQuestion> questions,
            boolean cvUsed,
            String aiModel,
            boolean cached,
            Integer remainingQuota) {}

    // ── 9. Rédaction d'offre assistée ─────────────────────────

    /**
     * @param brief           les quelques lignes du recruteur (obligatoire)
     * @param title           intitulé déjà saisi, si le recruteur en a un
     * @param contractType    CDI, CDD… (facultatif)
     */
    public record JobDraftRequest(
            @NotBlank @Size(min = 20, max = 1500) String brief,
            @Size(max = 255) String title,
            @Size(max = 40) String contractType,
            @Size(max = 150) String location,
            Boolean remote,
            SectorType sector,
            @PositiveOrZero @Max(30) Integer experienceYears) {}

    /**
     * Brouillon d'offre : rien n'est publié, le recruteur relit et modifie avant d'enregistrer.
     * @param suggestedSector secteur proposé par l'IA (valeur de SectorType), ou null
     */
    public record JobDraft(
            String title,
            String description,
            String requirements,
            List<String> skills,
            Integer experienceYears,
            SectorType suggestedSector,
            List<String> tips,
            String aiModel,
            Integer remainingQuota) {}
}
