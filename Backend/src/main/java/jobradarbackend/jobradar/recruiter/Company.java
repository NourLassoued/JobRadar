package jobradarbackend.jobradar.recruiter;

import jakarta.persistence.*;
import jobradarbackend.jobradar.candidate.SectorType;
import jobradarbackend.jobradar.user.User;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

/**
 * Profil entreprise d'un recruteur (table companies).
 * Un utilisateur possède au plus une entreprise : c'est elle qui publie les offres.
 */
@Entity
@Table(name = "companies",
        uniqueConstraints = @UniqueConstraint(name = "uk_company_owner", columnNames = "owner_id"))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Company {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Compte recruteur propriétaire */
    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "owner_id", nullable = false)
    private User owner;

    @Column(nullable = false, length = 150)
    private String name;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(length = 40)
    private SectorType sector;

    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private CompanySize size;

    @Column(length = 120)
    private String city;

    @Column(length = 255)
    private String website;

    @Column(name = "linkedin_url", length = 255)
    private String linkedinUrl;

    @Column(name = "logo_url", length = 1000)
    private String logoUrl;

    /** E-mail de contact affiché aux candidats (facultatif, sinon celui du compte) */
    @Column(name = "contact_email", length = 150)
    private String contactEmail;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}