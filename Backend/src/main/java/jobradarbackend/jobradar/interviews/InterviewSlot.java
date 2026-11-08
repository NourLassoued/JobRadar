package jobradarbackend.jobradar.interviews;

import jakarta.persistence.*;
import jobradarbackend.jobradar.applications.Application;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;

import java.time.LocalDateTime;

/**
 * Créneau d'entretien (table interview_slots).
 *
 * Le recruteur propose 1 à 3 créneaux ; le candidat en accepte un ou propose un autre moment.
 * Le créneau accepté devient un événement « Entretien » dans le suivi du candidat (activityId).
 */
@Entity
@Table(name = "interview_slots", indexes = {
        @Index(name = "idx_interview_slots_application", columnList = "application_id, status")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class InterviewSlot {

    /** Format de l'entretien */
    public enum Mode { VIDEO, PHONE, ONSITE }

    /** Qui a proposé le créneau */
    public enum Author { RECRUITER, CANDIDATE }

    /**
     * PROPOSED : en attente de réponse · ACCEPTED : entretien confirmé
     * DECLINED : écarté par l'autre partie · CANCELLED : remplacé par de nouveaux créneaux
     */
    public enum Status { PROPOSED, ACCEPTED, DECLINED, CANCELLED }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "application_id", nullable = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    private Application application;

    @Column(name = "starts_at", nullable = false)
    private LocalDateTime startsAt;

    @Column(name = "duration_minutes", nullable = false)
    private int durationMinutes;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Mode mode;

    /** Lien de visio, adresse ou numéro de téléphone */
    @Column(length = 300)
    private String location;

    @Enumerated(EnumType.STRING)
    @Column(name = "proposed_by", nullable = false, length = 20)
    private Author proposedBy;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Status status;

    /** Mot du candidat quand il propose un autre moment */
    @Column(columnDefinition = "TEXT")
    private String message;

    /** Événement créé dans le suivi du candidat quand le créneau est accepté */
    @Column(name = "activity_id")
    private Long activityId;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "responded_at")
    private LocalDateTime respondedAt;

    public LocalDateTime endsAt() {
        return startsAt.plusMinutes(durationMinutes);
    }
}
