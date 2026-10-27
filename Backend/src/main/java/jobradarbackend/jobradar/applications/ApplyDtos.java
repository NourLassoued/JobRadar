package jobradarbackend.jobradar.applications;

import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;

/** Candidature envoyée par un candidat à une offre publiée sur JobRadar */
public final class ApplyDtos {

    private ApplyDtos() {
    }

    /**
     * POST /api/applications/apply
     *
     * Le candidat choisit explicitement les deux documents : aucun n'est pris par défaut.
     *
     * @param cvId          CV choisi parmi ceux du candidat (GET /api/cvs)
     * @param coverLetterId lettre choisie parmi les siennes (GET /api/documents/cover-letters)
     */
    public record ApplyRequest(
            @NotNull(message = "Choisissez l'offre.") Long jobOfferId,
            @NotNull(message = "Choisissez un CV.") Long cvId,
            @NotNull(message = "Choisissez une lettre de motivation.") Long coverLetterId) {}

    public record ApplyResponse(
            Long applicationId,
            Long jobOfferId,
            String jobTitle,
            String company,
            ApplicationStatus status,
            Integer matchScore,
            LocalDate appliedAt) {}
}
