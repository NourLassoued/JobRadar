package jobradarbackend.jobradar.applications;

import jakarta.persistence.*;
import jobradarbackend.jobradar.user.User;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "application_events", indexes = @Index(name = "idx_app_events_application", columnList = "application_id, created_at"))
public class ApplicationEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "application_id", nullable = false)
    private Application application;

    @Enumerated(EnumType.STRING)
    @Column(name = "from_status", length = 20)
    private ApplicationStatus fromStatus;

    @Enumerated(EnumType.STRING)
    @Column(name = "to_status", nullable = false, length = 20)
    private ApplicationStatus toStatus;

    /** Message envoyé au candidat avec la décision (facultatif) */
    @Column(columnDefinition = "TEXT")
    private String message;

    /** Qui a fait le changement (null = le système) */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "actor_id")
    private User actor;

    /** CANDIDATE, RECRUITER, ADMIN ou SYSTEM */
    @Column(name = "actor_role", nullable = false, length = 20)
    private String actorRole;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    public Long getId() { return id; }
    public Application getApplication() { return application; }
    public void setApplication(Application application) { this.application = application; }
    public ApplicationStatus getFromStatus() { return fromStatus; }
    public void setFromStatus(ApplicationStatus fromStatus) { this.fromStatus = fromStatus; }
    public ApplicationStatus getToStatus() { return toStatus; }
    public void setToStatus(ApplicationStatus toStatus) { this.toStatus = toStatus; }
    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }
    public User getActor() { return actor; }
    public void setActor(User actor) { this.actor = actor; }
    public String getActorRole() { return actorRole; }
    public void setActorRole(String actorRole) { this.actorRole = actorRole; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}