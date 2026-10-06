package jobradarbackend.jobradar.candidate;

import jakarta.persistence.*;
import jobradarbackend.jobradar.candidate.language.CandidateLanguage;
import jobradarbackend.jobradar.user.User;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;


@Entity
@Table(name = "candidates")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Candidate {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String firstName;

    @Column(nullable = false, length = 100)
    private String lastName;

    @OneToOne(optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false, unique = true, length = 320)
    private String email;

    @Column(length = 20)
    private String phoneNumber;

    @Column(length = 200)
    private String city;

    @Enumerated(EnumType.STRING)
    @Column(length = 50)
    private SectorType sector;

    @Column(name = "years_of_experience")
    private Integer yearsOfExperience;
    @ElementCollection(fetch = FetchType.LAZY)
    @CollectionTable(name = "candidate_languages", joinColumns = @JoinColumn(name = "candidate_id"))
    private List<CandidateLanguage> languages = new ArrayList<>();

    public List<CandidateLanguage> getLanguages() { return languages; }

    @Column(length = 1000)
    private String bio;

    @Column(name = "expected_salary", precision = 10, scale = 2)
    private BigDecimal expectedSalary;

    @Column(name = "remote_preference")
    @Builder.Default
    private Boolean remotePreference = false;

    @Column(name = "profile_image_url", length = 500)
    private String profileImageUrl;

    @Column(name = "cv_url", length = 500)
    private String cvUrl;

    @Column(name = "linkedin_url", length = 500)
    private String linkedinUrl;

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private Boolean isActive = true;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "skills", columnDefinition = "jsonb")
    private List<String> skills;
    private LocalDateTime updatedAt;

    @PrePersist
    public void onCreate() {
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    public void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }
    public String getSectorAsEnumName() {
        return sector != null ? sector.name() : null;
    }

    public String getSectorDisplayName() {
        return sector != null ? sector.getDisplayName() : null;
    }
    public String getSectorSearchKeyword() {
        return sector != null ? sector.getSearchKeyword() : null;
    }
    public String getSectorDebugInfo() {
        if (sector == null) {
            return "null";
        }
        return String.format("%s | %s | %s",
                sector.name(),
                sector.getDisplayName(),
                sector.getSearchKeyword());
    }
}