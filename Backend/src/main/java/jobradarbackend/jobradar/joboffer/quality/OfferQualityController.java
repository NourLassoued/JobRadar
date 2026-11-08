package jobradarbackend.jobradar.joboffer.quality;

import jobradarbackend.jobradar.joboffer.quality.OfferQualityService.QualityReport;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

/**
 * Contrôle qualité des offres importées — réservé aux administrateurs.
 *  GET  /api/admin/offer-quality        dernier rapport
 *  POST /api/admin/offer-quality/run    lance le contrôle maintenant
 */
@RestController
@RequestMapping("/api/admin/offer-quality")
@RequiredArgsConstructor
public class OfferQualityController {

    private final OfferQualityService service;

    @GetMapping
    public ResponseEntity<?> report(Authentication auth) {
        requireAdmin(auth);
        return service.lastReport()
                .<ResponseEntity<?>>map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.ok(Map.of("message", "Aucun contrôle depuis le démarrage. Lancez POST /run.")));
    }

    @PostMapping("/run")
    public QualityReport run(Authentication auth) {
        requireAdmin(auth);
        try {
            return service.run();
        } catch (IllegalStateException e) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, e.getMessage());
        }
    }

    /** Double sécurité : même si la règle /api/admin/** manque dans SecurityConfig */
    private static void requireAdmin(Authentication auth) {
        boolean admin = auth != null && auth.getAuthorities().stream()
                .anyMatch(a -> "ROLE_ADMIN".equals(a.getAuthority()));
        if (!admin) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Réservé aux administrateurs.");
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, Object>> handle(ResponseStatusException e) {
        return ResponseEntity.status(e.getStatusCode())
                .body(Map.of("status", e.getStatusCode().value(), "message", String.valueOf(e.getReason())));
    }
}
