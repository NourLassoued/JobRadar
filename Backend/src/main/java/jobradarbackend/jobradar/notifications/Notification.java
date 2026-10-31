package jobradarbackend.jobradar.notifications;

import jakarta.persistence.*;
import jobradarbackend.jobradar.user.User;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

/** Message affiché dans la cloche d'un utilisateur (candidat, recruteur ou admin) */
@Entity
@Table(name = "notifications", indexes = @Index(name = "idx_notifications_user", columnList = "user_id, created_at"))
public class Notification {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    /** APPLICATION_DECISION, NEW_APPLICATION… : sert au front pour l'icône */
    @Column(nullable = false, length = 40)
    private String type;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String body;

    /** Page à ouvrir au clic, par exemple /app/candidatures */
    @Column(length = 300)
    private String link;

    @Column(name = "read_at")
    private LocalDateTime readAt;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    public Long getId() { return id; }
    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }
    public String getType() { return type; }
    public void setType(String type) { this.type = type; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getBody() { return body; }
    public void setBody(String body) { this.body = body; }
    public String getLink() { return link; }
    public void setLink(String link) { this.link = link; }
    public LocalDateTime getReadAt() { return readAt; }
    public void setReadAt(LocalDateTime readAt) { this.readAt = readAt; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}