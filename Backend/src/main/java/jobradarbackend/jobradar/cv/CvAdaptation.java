package jobradarbackend.jobradar.cv;

import jakarta.persistence.*;
import jobradarbackend.jobradar.applications.Application;
import jobradarbackend.jobradar.joboffer.JobOffer;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "cv_adaptations", indexes = {
        @Index(name = "idx_cv_adaptations_cv", columnList = "cv_id"),
        @Index(name = "idx_cv_adaptations_offer", columnList = "job_offer_id"),
        @Index(name = "idx_cv_adaptations_application", columnList = "application_id")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CvAdaptation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** CV de départ */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "cv_id", nullable = false)
    private CandidateCv cv;

    /** Offre visée */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "job_offer_id", nullable = false)
    private JobOffer jobOffer;

    /** Candidature qui utilise cette adaptation (facultatif) */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "application_id")
    private Application application;

    /** CV adapté (Markdown généré par l'IA) */
    @Column(name = "adapted_content", nullable = false, columnDefinition = "TEXT")
    private String adaptedContent;

    /** Conseils de l'IA */
    @Builder.Default
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private List<String> suggestions = new ArrayList<>();

    /** Mots-clés de l'offre mis en avant */
    @Builder.Default
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "keywords_added", columnDefinition = "jsonb")
    private List<String> keywordsAdded = new ArrayList<>();

    /** Couverture des technologies de l'offre avant / après (0-100) */
    @Column(name = "score_before")
    private Integer scoreBefore;

    @Column(name = "score_after")
    private Integer scoreAfter;

    /** Modèle d'IA utilisé, ex. « groq/llama-3.3-70b-versatile » */
    @Column(name = "ai_model", length = 80)
    private String aiModel;

    @Builder.Default
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private CvAdaptationStatus status = CvAdaptationStatus.DRAFT;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}