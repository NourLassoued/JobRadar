package jobradarbackend.jobradar.jooble;

import jobradarbackend.jobradar.candidate.SectorType;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Endpoints Jooble. Le frontend appelle uniquement ces routes : la clé reste côté serveur.
 */
@RestController
@RequestMapping("/api/jobs/jooble")
@RequiredArgsConstructor
public class JoobleController {

    private final JoobleClient client;
    private final JoobleSyncService syncService;
    private final JoobleProperties props;

    /**
     * TEST RAPIDE — GET /api/jobs/jooble/test?keywords=infirmier&location=Orléans
     * Appelle Jooble et affiche 5 résultats bruts, sans rien enregistrer.
     */
    @GetMapping("/test")
    public Map<String, Object> test(
            @RequestParam(defaultValue = "infirmier") String keywords,
            @RequestParam(required = false) String location) {

        JoobleSearchResponse response = client.search(keywords, location, 1, 5);

        List<Map<String, String>> offers = response.jobs().stream()
                .map(job -> Map.of(
                        "id", String.valueOf(job.id()),
                        "title", String.valueOf(job.title()),
                        "company", job.company() == null ? "" : job.company(),
                        "location", job.location() == null ? "" : job.location(),
                        "type", job.type() == null ? "" : job.type(),
                        "origin", job.source() == null ? "" : job.source()))
                .toList();

        return Map.of(
                "configured", props.isConfigured(),
                "totalJooble", response.totalCount() == null ? 0 : response.totalCount(),
                "received", offers.size(),
                "offers", offers);
    }

    /**
     * GET /api/jobs/jooble?keywords=infirmier&location=Orléans&page=1&resultsPerPage=20&sector=HEALTH
     * Recherche, enregistre les offres (sans doublon) et les renvoie avec leur id.
     */
    @GetMapping
    public ResponseEntity<JoobleSyncService.SearchResult> search(
            @RequestParam(required = false) String keywords,
            @RequestParam(required = false) String location,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(required = false) Integer resultsPerPage,
            @RequestParam(required = false) SectorType sector) {

        return ResponseEntity.ok(syncService.searchAndImport(keywords, location, page, resultsPerPage, sector));
    }

    /** POST /api/jobs/jooble/sync — synchronisation complète (administrateurs) */
    @PostMapping("/sync")
    @PreAuthorize("hasRole('ADMIN')")
    public Map<String, Object> syncAll() {
        Map<String, Integer> byLocation = syncService.syncAll();
        int total = byLocation.values().stream().mapToInt(Integer::intValue).sum();
        return Map.of("source", JoobleMapper.SOURCE, "imported", total, "byLocation", byLocation);
    }

    /** Erreurs Jooble → codes HTTP clairs, sans détail technique ni clé */
    @ExceptionHandler(JoobleException.class)
    public ResponseEntity<Map<String, Object>> handleJooble(JoobleException e) {
        HttpStatus status = switch (e.getReason()) {
            case BAD_REQUEST -> HttpStatus.BAD_REQUEST;
            case RATE_LIMITED -> HttpStatus.TOO_MANY_REQUESTS;
            case NOT_CONFIGURED, INVALID_CREDENTIALS, UNAVAILABLE -> HttpStatus.SERVICE_UNAVAILABLE;
        };
        String message = switch (e.getReason()) {
            case BAD_REQUEST -> "Recherche invalide. Vérifiez le mot-clé et le lieu.";
            case RATE_LIMITED -> "Trop de recherches Jooble pour le moment. Réessayez plus tard.";
            default -> "Les offres Jooble sont momentanément indisponibles.";
        };
        return ResponseEntity.status(status).body(Map.of(
                "source", JoobleMapper.SOURCE,
                "reason", e.getReason().name(),
                "message", message));
    }
}