package jobradarbackend.jobradar.cv;

import jobradarbackend.jobradar.ai.AiException;
import lombok.extern.slf4j.Slf4j;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;


@Slf4j
@Component
public class CvTextExtractor {

    private static final int MAX_BYTES = 5 * 1024 * 1024;   // 5 Mo
    private final RestClient restClient = RestClient.create();

    public String extract(String fileUrl, String contentType, String fileName) {
        boolean isPdf = (contentType != null && contentType.contains("pdf"))
                || (fileName != null && fileName.toLowerCase().endsWith(".pdf"))
                || (fileUrl != null && fileUrl.toLowerCase().contains(".pdf"));
        if (!isPdf) {
            throw new AiException(AiException.Reason.CV_TEXT_MISSING,
                    "Seuls les CV au format PDF peuvent être lus pour le moment.");
        }

        byte[] bytes;
        try {
            bytes = restClient.get().uri(fileUrl).retrieve().body(byte[].class);
        } catch (Exception e) {
            log.warn("Téléchargement du CV impossible ({}) : {}", fileUrl, e.getMessage());
            throw new AiException(AiException.Reason.CV_TEXT_MISSING,
                    "Le fichier du CV n'a pas pu être téléchargé. Vérifiez qu'il est toujours disponible.", e);
        }
        if (bytes == null || bytes.length == 0) {
            throw new AiException(AiException.Reason.CV_TEXT_MISSING, "Le fichier du CV est vide.");
        }
        if (bytes.length > MAX_BYTES) {
            throw new AiException(AiException.Reason.CV_TEXT_MISSING, "Le CV dépasse 5 Mo.");
        }

        try (PDDocument document = Loader.loadPDF(bytes)) {
            String text = new PDFTextStripper().getText(document).strip();
            if (text.length() < 100) {
                // PDF scanné (image) : pas de texte lisible
                throw new AiException(AiException.Reason.CV_TEXT_MISSING,
                        "Le texte du CV n'est pas lisible (PDF scanné ?). Exportez votre CV en PDF depuis Word ou Google Docs.");
            }
            return text;
        } catch (AiException e) {
            throw e;
        } catch (Exception e) {
            throw new AiException(AiException.Reason.CV_TEXT_MISSING, "Le PDF du CV n'a pas pu être lu.", e);
        }
    }
}