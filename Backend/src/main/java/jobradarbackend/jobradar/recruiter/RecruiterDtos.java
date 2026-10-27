package jobradarbackend.jobradar.recruiter;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import jobradarbackend.jobradar.applications.ApplicationStatus;
import jobradarbackend.jobradar.candidate.SectorType;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public final class RecruiterDtos {

    private RecruiterDtos() {
    }


    public record CompanyRequest(
            @NotBlank @Size(max = 150) String name,
            @Size(max = 5000) String description,
            @NotNull SectorType sector,
            CompanySize size,
            @Size(max = 120) String city,
            @Size(max = 255) String website,
            @Size(max = 255) String linkedinUrl,
            @Size(max = 1000) String logoUrl,
            @Email @Size(max = 150) String contactEmail) {}

    public record CompanyResponse(
            Long id, String name, String description, SectorType sector, CompanySize size, String city,
            String website, String linkedinUrl, String logoUrl, String contactEmail,
            LocalDateTime createdAt, long activeJobs) {}


    public record JobPostRequest(
            @NotBlank @Size(max = 255) String title,
            @NotBlank @Size(min = 50, max = 10000) String description,
            @Size(max = 5000) String requirements,
            @NotBlank @Size(max = 150) String location,
            @NotBlank String contractType,
            boolean remote,
            @PositiveOrZero Integer salaryMin,
            @PositiveOrZero Integer salaryMax,
            @NotNull SectorType sector,
            @Size(max = 20) List<@NotBlank @Size(max = 60) String> skills,
            @PositiveOrZero @Max(30) Integer experienceYears) {}

    /** PATCH /api/recruiter/jobs/{id}/status : fermer ou rouvrir une offre */
    public record JobStatusRequest(boolean active) {}

    public record RecruiterJobResponse(
            Long id, String title, String description, String requirements, String location,
            String contractType, boolean remote, Integer salaryMin, Integer salaryMax, String sector,
            List<String> skills, Integer experienceYears,
            boolean active, LocalDateTime createdAt,
            /** Candidatures reçues (envoyées, en entretien, proposition, refusées) */
            long applicantsCount) {}

    // ── Candidats ────────────────────────────────────────────

    /** Une candidature reçue, avec le score de compatibilité calculé par JobRadar */
    public record ApplicantResponse(
            Long applicationId,
            Long candidateId,
            String firstName,
            String lastName,
            String email,
            String phoneNumber,
            String city,
            String profileImageUrl,
            String linkedinUrl,
            SectorType sector,
            Integer yearsOfExperience,
            List<String> skills,
            Integer matchScore,
            List<String> matchedSkills,
            List<String> missingSkills,
            ApplicationStatus status,
            LocalDate appliedAt,
            String cvUrl,
            /** Ancienne lettre en texte (candidatures faites avant le formulaire) */
            String coverLetter,
            /** Nom du CV choisi par le candidat */
            String cvName,
            /** Lettre de motivation choisie dans le formulaire (fichier PDF / Word) */
            String coverLetterUrl,
            String coverLetterName) {}

    /** PATCH /api/recruiter/applications/{id}/status : décision du recruteur */
    public record ApplicantStatusRequest(@NotNull ApplicationStatus status) {}
}