package jobradarbackend.jobradar.adzuna;

import jobradarbackend.jobradar.candidate.SectorType;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Endpoints Adzuna. Le frontend appelle uniquement ces routes :
 * les clés Adzuna restent côté serveur.
 */
@RestController
@RequestMapping("/api/jobs/adzuna")
@RequiredArgsConstructor
public class AdzunaController {

    private final AdzunaClient client;
    private final AdzunaSyncService syncService;
    private final AdzunaProperties props;

    /**
     * TEST RAPIDE — GET /api/jobs/adzuna/test?what=infirmier&where=Orléans
     * Appelle Adzuna et affiche les résultats bruts, SANS rien enregistrer en base.
     * Sert à vérifier les clés et la connexion avant de tester l'import.
     */
    @GetMapping("/test")
    public Map<String, Object> test(
            @RequestParam(required = false) String country,
            @RequestParam(defaultValue = "infirmier") String what,
            @RequestParam(required = false) String where) {

        AdzunaSearchResponse response = client.search(country, what, where, 1, 5);

        List<Map<String, String>> offers = response.results().stream()
                .map(job -> Map.of(
                        "id", String.valueOf(job.id()),
                        "title", String.valueOf(job.title()),
                        "company", job.company() != null ? String.valueOf(job.company().displayName()) : "",
                        "location", job.location() != null ? String.valueOf(job.location().displayName()) : "",
                        "category", job.category() != null ? String.valueOf(job.category().tag()) : ""))
                .toList();

        return Map.of(
                "configured", props.isConfigured(),
                "country", props.resolveCountry(country) == null ? "inconnu" : props.resolveCountry(country),
                "totalAdzuna", response.count() == null ? 0 : response.count(),
                "received", offers.size(),
                "offers", offers);
    }

    /**
     * GET /api/jobs/adzuna?country=fr&what=infirmier&where=Orléans&page=1&sector=HEALTH
     * Recherche, enregistre les offres (sans doublon) et les renvoie avec leur id.
     */
    @GetMapping
    public ResponseEntity<AdzunaSyncService.SearchResult> search(
            @RequestParam(required = false) String country,
            @RequestParam(required = false) String what,
            @RequestParam(required = false) String where,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(required = false) Integer resultsPerPage,
            @RequestParam(required = false) SectorType sector) {

        return ResponseEntity.ok(syncService.searchAndImport(country, what, where, page, resultsPerPage, sector));
    }

    /** GET /api/jobs/adzuna/countries — pays disponibles */
    @GetMapping("/countries")
    public Map<String, Object> countries() {
        return Map.of("countries", props.getCountries(), "default", props.getDefaultCountry());
    }

    /** POST /api/jobs/adzuna/sync — synchronisation complète (administrateurs) */
    @PostMapping("/sync")
    @PreAuthorize("hasRole('ADMIN')")
    public Map<String, Object> syncAll() {
        Map<String, Integer> byCountry = syncService.syncAll();
        int total = byCountry.values().stream().mapToInt(Integer::intValue).sum();
        return Map.of("source", AdzunaMapper.SOURCE, "imported", total, "byCountry", byCountry);
    }

    /** Erreurs Adzuna → codes HTTP clairs, sans détail technique ni clé */
    @ExceptionHandler(AdzunaException.class)
    public ResponseEntity<Map<String, Object>> handleAdzuna(AdzunaException e) {
        HttpStatus status = switch (e.getReason()) {
            case BAD_REQUEST, UNSUPPORTED_COUNTRY -> HttpStatus.BAD_REQUEST;
            case RATE_LIMITED -> HttpStatus.TOO_MANY_REQUESTS;
            case NOT_CONFIGURED, INVALID_CREDENTIALS, UNAVAILABLE -> HttpStatus.SERVICE_UNAVAILABLE;
        };
        return ResponseEntity.status(status).body(Map.of(
                "source", AdzunaMapper.SOURCE,
                "reason", e.getReason().name(),
                "message", e.getMessage()));
    }
}