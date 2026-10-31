package jobradarbackend.jobradar.applications;

import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;

public final class ApplyDtos {

    private ApplyDtos() {
    }


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
