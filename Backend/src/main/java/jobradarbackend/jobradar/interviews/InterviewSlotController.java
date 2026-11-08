package jobradarbackend.jobradar.interviews;

import jakarta.validation.Valid;
import jobradarbackend.jobradar.interviews.InterviewSlotDtos.*;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.security.Principal;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Créneaux d'entretien.
 *  - côté recruteur : /api/recruiter/applications/{id}/interview-slots
 *  - côté candidat  : /api/tracking/applications/{id}/interview-slots
 * (mêmes règles d'accès que le reste de l'espace recruteur / du suivi candidat)
 */
@RestController
public class InterviewSlotController {

    private final InterviewSlotService service;

    public InterviewSlotController(InterviewSlotService service) {
        this.service = service;
    }

    // ── Recruteur ────────────────────────────────────────────

    @GetMapping("/api/recruiter/applications/{id}/interview-slots")
    public InterviewSlots recruiterSlots(@PathVariable Long id, Principal principal) {
        return service.forRecruiter(principal, id);
    }

    @PostMapping("/api/recruiter/applications/{id}/interview-slots")
    public ProposeResult propose(@PathVariable Long id, @Valid @RequestBody ProposeRequest req, Principal principal) {
        return service.propose(principal, id, req);
    }

    @PostMapping("/api/recruiter/applications/{id}/interview-slots/{slotId}/confirm")
    public InterviewSlots confirm(@PathVariable Long id, @PathVariable Long slotId,
                                  @Valid @RequestBody ConfirmRequest req, Principal principal) {
        return service.confirmCandidateProposal(principal, id, slotId, req);
    }

    // ── Candidat ─────────────────────────────────────────────

    @GetMapping("/api/tracking/applications/{id}/interview-slots")
    public InterviewSlots candidateSlots(@PathVariable Long id, Principal principal) {
        return service.forCandidate(principal, id);
    }

    @PostMapping("/api/tracking/applications/{id}/interview-slots/{slotId}/accept")
    public InterviewSlots accept(@PathVariable Long id, @PathVariable Long slotId, Principal principal) {
        return service.acceptSlot(principal, id, slotId);
    }

    @PostMapping("/api/tracking/applications/{id}/interview-slots/counter")
    public InterviewSlots counter(@PathVariable Long id, @Valid @RequestBody CounterRequest req, Principal principal) {
        return service.counterPropose(principal, id, req);
    }

    // ── Erreurs : { status, message } comme les autres contrôleurs ──

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, Object>> handleStatus(ResponseStatusException e) {
        return ResponseEntity.status(e.getStatusCode())
                .body(Map.of("status", e.getStatusCode().value(), "message", String.valueOf(e.getReason())));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidation(MethodArgumentNotValidException e) {
        boolean past = e.getBindingResult().getFieldErrors().stream()
                .anyMatch(f -> "Future".equals(f.getCode()));
        String message = past ? "Choisissez une date à venir."
                : "Champs invalides : " + e.getBindingResult().getFieldErrors().stream()
                    .map(FieldError::getField).distinct().collect(Collectors.joining(", ")) + ".";
        return ResponseEntity.badRequest().body(Map.of("status", 400, "message", message));
    }
}
