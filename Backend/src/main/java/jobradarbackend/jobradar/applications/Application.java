package jobradarbackend.jobradar.applications;

import jakarta.persistence.*;
import jobradarbackend.jobradar.candidate.Candidate;
import jobradarbackend.jobradar.cv.CandidateCv;
import jobradarbackend.jobradar.documents.CoverLetterDocument;
import jobradarbackend.jobradar.joboffer.JobOffer;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;


@Entity
@Table(name = "applications",
        uniqueConstraints = @UniqueConstraint(name = "uk_application_candidate_offer",
                columnNames = {"candidate_id", "job_offer_id"}),
        indexes = {
                @Index(name = "idx_applications_candidate_status", columnList = "candidate_id, status"),
                @Index(name = "idx_applications_offer", columnList = "job_offer_id")
        })
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Application {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "candidate_id", nullable = false)
    private Candidate candidate;

    /** Offre JobRadar (null pour une candidature ajoutée à la main) */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "job_offer_id")
    private JobOffer jobOffer;

    /** CV envoyé */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cv_id")
    private CandidateCv cv;

    /** Lettre de motivation choisie au moment de la candidature */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cover_letter_id")
    private CoverLetterDocument coverLetterDocument;

    // ── Copie de l'offre au moment de la candidature ─────────
    @Column(name = "job_title", nullable = false)
    private String jobTitle;

    @Column(name = "company")
    private String company;

    @Column(name = "job_url", length = 1000)
    private String jobUrl;

    /** Ville / lieu (copié de l'offre, ou saisi pour une candidature externe) */
    @Column(name = "location", length = 150)
    private String location;

    /** CDI, CDD, STAGE… (copié de l'offre, ou saisi) */
    @Column(name = "contract_type", length = 40)
    private String contractType;

    // ── Suivi ────────────────────────────────────────────────
    @Builder.Default
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ApplicationStatus status = ApplicationStatus.TO_APPLY;

    /** Ordre de la carte dans sa colonne du Kanban */
    @Builder.Default
    @Column(name = "board_position", nullable = false)
    private int position = 0;

    /** Score de matching au moment de la candidature (0-100) */
    @Column(name = "match_score")
    private Integer matchScore;

    /** Lettre de motivation envoyée (texte final, anciennes candidatures) */
    @Column(name = "cover_letter", columnDefinition = "TEXT")
    private String coverLetter;

    /** Date d'envoi de la candidature */
    @Column(name = "applied_at")
    private LocalDate appliedAt;

    /** Date de relance choisie par le candidat */
    @Column(name = "next_action_at")
    private LocalDate nextActionAt;

    // ── Contact chez le recruteur (saisi par le candidat) ────
    @Column(name = "contact_name", length = 120)
    private String contactName;

    @Column(name = "contact_role", length = 120)
    private String contactRole;

    @Column(name = "contact_email", length = 150)
    private String contactEmail;

    @Column(name = "contact_phone", length = 40)
    private String contactPhone;

    /** Notes de suivi, de la plus récente à la plus ancienne */
    @Builder.Default
    @OneToMany(mappedBy = "application", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("createdAt DESC")
    private List<ApplicationNote> notes = new ArrayList<>();

    /** Entretiens, appels, tests techniques… */
    @Builder.Default
    @OneToMany(mappedBy = "application", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("scheduledAt ASC")
    private List<ApplicationActivity> activities = new ArrayList<>();

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    // ── Méthodes utiles ──────────────────────────────────────

    /** Ajoute une note en gardant les deux côtés de la relation à jour */
    public void addNote(ApplicationNote note) {
        notes.add(note);
        note.setApplication(this);
    }

    public void removeNote(ApplicationNote note) {
        notes.remove(note);
        note.setApplication(null);
    }

    public void addActivity(ApplicationActivity activity) {
        activities.add(activity);
        activity.setApplication(this);
    }

    public void removeActivity(ApplicationActivity activity) {
        activities.remove(activity);
        activity.setApplication(null);
    }

    /**
     * Change d'étape. Toute étape après « Enregistrée » (sauf un retrait direct) signifie que la
     * candidature est partie : la date d'envoi est alors renseignée si elle est vide.
     */
    public void moveTo(ApplicationStatus newStatus) {
        this.status = newStatus;
        if (appliedAt == null && newStatus != ApplicationStatus.TO_APPLY && newStatus != ApplicationStatus.WITHDRAWN) {
            appliedAt = LocalDate.now();
        }
    }
}
