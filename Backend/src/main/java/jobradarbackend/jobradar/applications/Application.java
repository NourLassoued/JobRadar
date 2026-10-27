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

/**
 * Une candidature (table applications) = une carte du Kanban.
 * Titre, entreprise et URL sont copiés : la candidature reste lisible même si l'offre disparaît.
 */
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

    // ── Copie de l'offre ─────────────────────────────────────
    @Column(name = "job_title", nullable = false)
    private String jobTitle;

    @Column(name = "company")
    private String company;

    @Column(name = "job_url", length = 1000)
    private String jobUrl;

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

    /** Lettre de motivation envoyée */
    @Column(name = "cover_letter", columnDefinition = "TEXT")
    private String coverLetter;

    @Column(name = "applied_at")
    private LocalDate appliedAt;

    /** Prochaine action (relance, entretien…) */
    @Column(name = "next_action_at")
    private LocalDate nextActionAt;

    @Builder.Default
    @OneToMany(mappedBy = "application", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("createdAt DESC")
    private List<ApplicationNote> notes = new ArrayList<>();

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cover_letter_id")
    private CoverLetterDocument coverLetterDocument;
    public void addNote(ApplicationNote note) {
        notes.add(note);
        note.setApplication(this);
    }

    public void removeNote(ApplicationNote note) {
        notes.remove(note);
        note.setApplication(null);
    }

    /** Change d'étape ; « envoyée » renseigne la date si elle est vide */
    public void moveTo(ApplicationStatus newStatus) {
        this.status = newStatus;
        if (newStatus == ApplicationStatus.APPLIED && appliedAt == null) {
            appliedAt = LocalDate.now();
        }
    }
}