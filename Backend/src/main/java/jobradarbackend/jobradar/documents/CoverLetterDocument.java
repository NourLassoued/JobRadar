package jobradarbackend.jobradar.documents;

import jakarta.persistence.*;
import jobradarbackend.jobradar.candidate.Candidate;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

/** Lettre de motivation enregistrée par un candidat (fichier PDF / Word), réutilisable pour plusieurs candidatures */
@Entity
@Table(name = "candidate_cover_letters")
public class CoverLetterDocument {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "candidate_id", nullable = false)
    private Candidate candidate;

    /** Nom choisi par le candidat (par défaut : nom du fichier) */
    @Column(nullable = false, length = 150)
    private String title;

    @Column(name = "file_name", nullable = false, length = 150)
    private String fileName;

    @Column(name = "file_url", nullable = false, length = 1000)
    private String fileUrl;

    @Column(name = "content_type", length = 120)
    private String contentType;

    @Column(name = "file_size")
    private Long fileSize;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    public Long getId() { return id; }

    public Candidate getCandidate() { return candidate; }
    public void setCandidate(Candidate candidate) { this.candidate = candidate; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getFileName() { return fileName; }
    public void setFileName(String fileName) { this.fileName = fileName; }

    public String getFileUrl() { return fileUrl; }
    public void setFileUrl(String fileUrl) { this.fileUrl = fileUrl; }

    public String getContentType() { return contentType; }
    public void setContentType(String contentType) { this.contentType = contentType; }

    public Long getFileSize() { return fileSize; }
    public void setFileSize(Long fileSize) { this.fileSize = fileSize; }

    public LocalDateTime getCreatedAt() { return createdAt; }
}