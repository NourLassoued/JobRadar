package jobradarbackend.jobradar.documents;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.util.Map;
import java.util.UUID;


@Service
public class DocumentStorageService {

    private static final Logger log = LoggerFactory.getLogger(DocumentStorageService.class);

    /** 5 Mo maximum (même limite que spring.servlet.multipart.max-file-size) */
    static final long MAX_BYTES = 5L * 1024 * 1024;

    /** Formats acceptés → extension enregistrée */
    static final Map<String, String> ALLOWED = Map.of(
            "application/pdf", "pdf",
            "application/msword", "doc",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "docx");

    /** Fichier enregistré : ce qu'il faut garder en base */
    public record StoredFile(String fileUrl, String fileName, String contentType, long fileSize) {}

    private final RestClient http = RestClient.create();
    private final String supabaseUrl;
    private final String supabaseKey;
    private final String bucket;

    public DocumentStorageService(@Value("${supabase.url}") String supabaseUrl,
                                  @Value("${supabase.key}") String supabaseKey,
                                  @Value("${supabase.documents-bucket:profiles}") String bucket) {
        this.supabaseUrl = supabaseUrl.replaceAll("/+$", "");
        this.supabaseKey = supabaseKey;
        this.bucket = bucket;
    }

    /**
     */
    public StoredFile upload(String folder, Long ownerId, MultipartFile file) {
        String extension = check(file);
        String path = folder + "/" + ownerId + "-" + UUID.randomUUID() + "." + extension;

        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Fichier illisible.");
        }

        try {
            http.post()
                    .uri(supabaseUrl + "/storage/v1/object/" + bucket + "/" + path)
                    .header("Authorization", "Bearer " + supabaseKey)
                    .header("apikey", supabaseKey)
                    .contentType(MediaType.parseMediaType(file.getContentType()))
                    .body(bytes)
                    .retrieve()
                    .toBodilessEntity();
        } catch (RestClientException e) {
            log.error("Échec de l'envoi du document vers Supabase : {}", e.getMessage());
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "Le document n'a pas pu être enregistré. Réessayez dans un instant.");
        }

        String publicUrl = supabaseUrl + "/storage/v1/object/public/" + bucket + "/" + path;
        log.info("Document envoyé ({}) : {}", folder, path);
        return new StoredFile(publicUrl, cleanName(file.getOriginalFilename(), extension),
                file.getContentType(), file.getSize());
    }

    /** Renvoie l'extension, ou lève une erreur lisible */
    static String check(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Aucun fichier reçu.");
        }
        if (file.getSize() > MAX_BYTES) {
            throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE, "Fichier trop volumineux (max 5 Mo).");
        }
        String type = file.getContentType() == null ? "" : file.getContentType().toLowerCase();
        String extension = ALLOWED.get(type);
        if (extension == null) {
            throw new ResponseStatusException(HttpStatus.UNSUPPORTED_MEDIA_TYPE,
                    "Format non accepté : envoyez un PDF ou un document Word (.doc, .docx).");
        }
        return extension;
    }

    /** Nom affiché : celui du fichier d'origine, sans chemin, 120 caractères max */
    static String cleanName(String original, String extension) {
        String name = original == null ? "" : original.replace('\\', '/');
        name = name.substring(name.lastIndexOf('/') + 1).strip();
        if (name.isEmpty()) name = "document." + extension;
        return name.length() > 120 ? name.substring(0, 120) : name;
    }
}
