package jobradarbackend.jobradar.cv;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.LocalDateTime;

/** Objets échangés avec le front pour les CV */
public final class CvDtos {

    private CvDtos() {
    }

    /** Enregistrer un CV déjà envoyé sur Supabase (le front fait l'upload, puis appelle POST /api/cvs) */
    public record CreateCvRequest(
            @NotBlank @Size(max = 120) String title,
            @NotBlank String fileName,
            @NotBlank @Size(max = 1000) String fileUrl,
            String contentType,
            Long fileSize,
            boolean makeDefault) {}

    public record CvResponse(Long id, String title, String fileName, String fileUrl, String contentType,
                             Long fileSize, boolean defaultCv, boolean textReady, LocalDateTime createdAt) {

        public static CvResponse from(CandidateCv cv) {
            return new CvResponse(cv.getId(), cv.getTitle(), cv.getFileName(), cv.getFileUrl(), cv.getContentType(),
                    cv.getFileSize(), cv.isDefaultCv(), cv.getExtractedText() != null && !cv.getExtractedText().isBlank(),
                    cv.getCreatedAt());
        }
    }
}