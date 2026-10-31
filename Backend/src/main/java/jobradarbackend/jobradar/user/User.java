package jobradarbackend.jobradar.user;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import jobradarbackend.jobradar.push.PushSubscription;
import lombok.*;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "users")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 320)
    private String email;

    // Nullable car les utilisateurs OAuth (Google/LinkedIn) n'ont pas de mot de passe local
    @Column
    private String password;

    @Column(nullable = false, length = 100)
    private String firstName;

    @Column(nullable = false, length = 100)
    private String lastName;

    // URL de la photo de profil (fournie par Google/LinkedIn)
    @Column(length = 500)
    private String avatarUrl;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private Role role = Role.USER;

    // Provider d'authentification : LOCAL, GOOGLE, LINKEDIN
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private AuthProvider provider = AuthProvider.LOCAL;

    // Identifiant unique fourni par le provider OAuth (sub Google/LinkedIn)
    @Column(length = 255)
    private String providerId;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column
    private LocalDateTime lastLoginAt;
    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL, orphanRemoval = true)
    @JsonIgnore
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private List<PushSubscription> pushSubscriptions = new ArrayList<>();
    @PrePersist
    public void onCreate() {
        this.createdAt = LocalDateTime.now();
    }
}