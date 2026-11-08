package jobradarbackend.jobradar.applications.trancking;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import jobradarbackend.jobradar.applications.ActivityType;
import jobradarbackend.jobradar.applications.ApplicationStatus;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/** Objets échangés avec le front pour le suivi des candidatures (Kanban du candidat) */
public final class TrackingDtos {

    private TrackingDtos() {
    }

    // ── Kanban ───────────────────────────────────────────────

    /** Une carte du Kanban */
    public record ApplicationCard(
            Long id,
            /** Offre JobRadar ou importée (null : candidature ajoutée à la main) */
            Long jobOfferId,
            String jobTitle,
            String company,
            String companyLogoUrl,
            String location,
            String contractType,
            ApplicationStatus status,
            LocalDate appliedAt,
            LocalDateTime createdAt,
            LocalDateTime updatedAt,
            /** Prochain entretien (ou test / appel) à venir, s'il y en a un */
            LocalDateTime nextEventAt,
            ActivityType nextEventType,
            /** Date de relance choisie par le candidat */
            LocalDate followUpAt,
            /** Lien vers l'offre d'origine (site externe) */
            String jobUrl,
            Integer matchScore,
            /**
             * Offre publiée par une entreprise sur JobRadar : c'est le recruteur qui fait avancer
             * la candidature ; le candidat peut seulement la retirer.
             */
            boolean managedByRecruiter,
            /** Colonnes vers lesquelles le candidat peut déplacer cette carte */
            List<ApplicationStatus> allowedMoves) {}

    /** PATCH /{id}/status : déplacement d'une carte */
    public record MoveRequest(@NotNull ApplicationStatus status) {}

    /**
     * POST / : ajouter une candidature au suivi.
     * - avec jobOfferId : enregistrer une offre JobRadar / France Travail (colonne « Enregistrée ») ;
     * - sans jobOfferId : candidature faite ailleurs (LinkedIn, site de l'entreprise…).
     */
    public record CreateRequest(
            Long jobOfferId,
            @Size(max = 255) String jobTitle,
            @Size(max = 255) String company,
            @Size(max = 1000) String jobUrl,
            @Size(max = 150) String location,
            @Size(max = 40) String contractType,
            ApplicationStatus status,
            LocalDate appliedAt) {}

    /** PATCH /{id} : informations modifiables par le candidat (champs null = inchangés) */
    public record UpdateRequest(
            @Size(max = 255) String jobTitle,
            @Size(max = 255) String company,
            @Size(max = 1000) String jobUrl,
            @Size(max = 150) String location,
            @Size(max = 40) String contractType,
            LocalDate appliedAt,
            @Size(max = 120) String contactName,
            @Size(max = 120) String contactRole,
            @Email @Size(max = 150) String contactEmail,
            @Size(max = 40) String contactPhone) {}

    /** PUT /{id}/follow-up : date de relance (null = supprimer la relance) */
    public record FollowUpRequest(LocalDate followUpAt) {}

    // ── Détail ───────────────────────────────────────────────

    public record ApplicationDetail(
            ApplicationCard card,
            OfferInfo offer,
            Documents documents,
            Contact contact,
            List<NoteItem> notes,
            List<ActivityItem> activities,
            List<HistoryItem> history) {}

    /** Informations de l'offre (null pour une candidature ajoutée à la main) */
    public record OfferInfo(
            String description,
            String requirements,
            BigDecimal salaryMin,
            BigDecimal salaryMax,
            Boolean remote,
            String sector,
            String source,
            boolean active,
            LocalDateTime publishedAt) {}

    /** CV et lettre de motivation envoyés */
    public record Documents(
            String cvName,
            String cvUrl,
            String coverLetterName,
            String coverLetterUrl,
            /** Lettre en texte (anciennes candidatures) */
            String coverLetterText) {}

    public record Contact(String name, String role, String email, String phone) {}

    public record NoteItem(Long id, String content, LocalDateTime createdAt) {}

    public record NoteRequest(@NotBlank @Size(max = 5000) String content) {}

    public record ActivityItem(Long id, ActivityType type, String title, LocalDateTime scheduledAt,
                               String location, String details, boolean done) {}

    public record ActivityRequest(
            @NotNull ActivityType type,
            @NotBlank @Size(max = 150) String title,
            @NotNull LocalDateTime scheduledAt,
            @Size(max = 300) String location,
            @Size(max = 5000) String details) {}

    /** PATCH /{id}/activities/{activityId} */
    public record ActivityDoneRequest(boolean done) {}

    public record HistoryItem(Long id, ApplicationStatus fromStatus, ApplicationStatus toStatus,
                              String message, String actorRole, LocalDateTime createdAt) {}

    // ── Statistiques ─────────────────────────────────────────

    public record Stats(
            /** Toutes les cartes du Kanban, enregistrées comprises */
            long total,
            /** Candidatures réellement envoyées */
            long sent,
            /** Candidatures ayant obtenu au moins un entretien */
            long interviews,
            /** Candidatures ayant reçu une offre (ou une embauche) */
            long offers,
            long rejected,
            long withdrawn,
            /** Taux candidature → entretien, en % (null si aucune candidature envoyée) */
            Double applicationToInterviewRate,
            /** Taux entretien → offre, en % (null si aucun entretien) */
            Double interviewToOfferRate) {}
}