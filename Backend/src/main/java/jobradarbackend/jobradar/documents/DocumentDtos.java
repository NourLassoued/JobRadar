package jobradarbackend.jobradar.documents;

import java.time.LocalDateTime;

public final class DocumentDtos {

    private DocumentDtos() {
    }

    /** Réponse de POST /api/documents/cv-file : à enregistrer ensuite avec POST /api/cvs */
    public record UploadedFileResponse(String fileUrl, String fileName, String contentType, long fileSize) {}

    /** Lettre de motivation enregistrée */
    public record CoverLetterResponse(Long id, String title, String fileName, String fileUrl,
                                      String contentType, Long fileSize, LocalDateTime createdAt) {

        static CoverLetterResponse from(CoverLetterDocument d) {
            return new CoverLetterResponse(d.getId(), d.getTitle(), d.getFileName(), d.getFileUrl(),
                    d.getContentType(), d.getFileSize(), d.getCreatedAt());
        }
    }
}
