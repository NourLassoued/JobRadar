package jobradarbackend.jobradar.cv;

import jakarta.persistence.*;
import jobradarbackend.jobradar.candidate.Candidate;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

/**
 * Un CV du candidat (table candidate_cvs).
 * Un candidat peut avoir plusieurs CV ; un seul est le CV par défaut.
 * Le fichier est stocké dans Supabase Storage ; on garde ici son URL et son texte extrait.
 */
@Entity
@Table(name = "candidate_cvs", indexes = {
        @Index(name = "idx_candidate_cvs_candidate", columnList = "candidate_id")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CandidateCv {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Propriétaire du CV */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "candidate_id", nullable = false)
    private Candidate candidate;

    /** Nom donné par le candidat, ex. « CV Développeur Java » */
    @Column(nullable = false, length = 120)
    private String title;

    /** Nom du fichier d'origine, ex. « cv-nour-2026.pdf » */
    @Column(name = "file_name", nullable = false)
    private String fileName;

    /** URL du fichier dans Supabase Storage */
    @Column(name = "file_url", nullable = false, length = 1000)
    private String fileUrl;

    /** Type MIME : application/pdf… */
    @Column(name = "content_type", length = 120)
    private String contentType;

    /** Taille en octets */
    @Column(name = "file_size")
    private Long fileSize;

    /** Texte extrait du CV (PDFBox) : sert à l'adaptation par l'IA */
    @Column(name = "extracted_text", columnDefinition = "TEXT")
    private String extractedText;

    /** CV utilisé par défaut (pas « isDefault » : Lombok créerait setDefault()) */
    @Builder.Default
    @Column(name = "is_default", nullable = false)
    private boolean defaultCv = false;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}