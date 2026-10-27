package jobradarbackend.jobradar.recruiter;

import lombok.extern.slf4j.Slf4j;
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

/**
 * Envoie le logo d'une entreprise dans Supabase Storage et renvoie son adresse publique.
 *
 * Utilise la même configuration que les photos de profil (supabase.url / supabase.key)
 * et le bucket public « profiles », dans le dossier « companies/ ».
 */
@Slf4j
@Service
public class CompanyLogoService {

    /** 5 Mo maximum (même règle que la photo de profil candidat) */
    static final long MAX_BYTES = 5L * 1024 * 1024;

    /** Formats acceptés → extension du fichier enregistré (pas de SVG : il peut contenir du script) */
    static final Map<String, String> ALLOWED = Map.of(
            "image/png", "png",
            "image/jpeg", "jpg",
            "image/gif", "gif",
            "image/webp", "webp");

    private final RestClient http = RestClient.create();
    private final String supabaseUrl;
    private final String supabaseKey;
    private final String bucket;

    public CompanyLogoService(@Value("${supabase.url}") String supabaseUrl,
                              @Value("${supabase.key}") String supabaseKey,
                              @Value("${supabase.logo-bucket:profiles}") String bucket) {
        this.supabaseUrl = supabaseUrl.replaceAll("/+$", "");
        this.supabaseKey = supabaseKey;
        this.bucket = bucket;
    }

    /** Vérifie le fichier, l'envoie et renvoie l'adresse publique de l'image */
    public String upload(Long ownerId, MultipartFile file) {
        String extension = check(file);
        String path = "companies/" + ownerId + "-" + UUID.randomUUID() + "." + extension;

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
            log.error("Échec de l'envoi du logo vers Supabase : {}", e.getMessage());
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "Le logo n'a pas pu être enregistré. Réessayez dans un instant.");
        }

        String publicUrl = supabaseUrl + "/storage/v1/object/public/" + bucket + "/" + path;
        log.info("Logo entreprise envoyé : {}", publicUrl);
        return publicUrl;
    }

    /** Renvoie l'extension à utiliser, ou lève une erreur 400 lisible */
    static String check(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Aucun fichier reçu.");
        }
        if (file.getSize() > MAX_BYTES) {
            throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE, "Fichier trop volumineux (max 5MB).");
        }
        String extension = file.getContentType() == null ? null : ALLOWED.get(file.getContentType().toLowerCase());
        if (extension == null) {
            throw new ResponseStatusException(HttpStatus.UNSUPPORTED_MEDIA_TYPE,
                    "Format image invalide (JPEG, PNG, GIF, WebP acceptés).");
        }
        return extension;
    }
}