package jobradarbackend.jobradar.candidate;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;


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

    @Column(length = 2000)
    private String skills;

    @Column(length = 1000)
    private String bio;

    @Column(name = "expected_salary", precision = 10, scale = 2)
    private BigDecimal expectedSalary;
    @Column(name = "remote_preference")
    @Builder.Default
    private Boolean remotePreference = false;

    @Column(name = "cv_url", length = 500)
    private String cvUrl;

    @Column(name = "linkedin_url", length = 500)
    private String linkedinUrl;

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private Boolean isActive = true;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

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
}