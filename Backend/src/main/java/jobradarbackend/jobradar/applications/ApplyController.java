package jobradarbackend.jobradar.applications;

import jakarta.validation.Valid;
import jobradarbackend.jobradar.applications.ApplyDtos.ApplyRequest;
import jobradarbackend.jobradar.applications.ApplyDtos.ApplyResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.security.Principal;
import java.util.List;
import java.util.Map;

/**
 * POST /api/applications/apply : le candidat postule à une offre publiée sur JobRadar.
 * GET  /api/applications/applied-ids : offres auxquelles il a déjà postulé.
 */
@RestController
@RequestMapping("/api/applications")
public class ApplyController {

    private final ApplyService service;

    /** Injection par constructeur : Spring fournit ApplyService */
    public ApplyController(ApplyService service) {
        this.service = service;
    }

    @PostMapping("/apply")
    @ResponseStatus(HttpStatus.CREATED)
    public ApplyResponse apply(@Valid @RequestBody ApplyRequest request, Principal principal) {
        return service.apply(principal, request);
    }

    @GetMapping("/applied-ids")
    public List<Long> appliedOfferIds(Principal principal) {
        return service.appliedOfferIds(principal);
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, Object>> handleStatus(ResponseStatusException e) {
        return ResponseEntity.status(e.getStatusCode())
                .body(Map.of("status", e.getStatusCode().value(), "message", String.valueOf(e.getReason())));
    }
}