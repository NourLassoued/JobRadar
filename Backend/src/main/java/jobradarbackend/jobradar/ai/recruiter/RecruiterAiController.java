package jobradarbackend.jobradar.ai.recruiter;

import jakarta.validation.Valid;
import jobradarbackend.jobradar.ai.AiException;
import jobradarbackend.jobradar.ai.recruiter.RecruiterAiDtos.ApplicantInsight;
import jobradarbackend.jobradar.ai.recruiter.RecruiterAiDtos.JobDraft;
import jobradarbackend.jobradar.ai.recruiter.RecruiterAiDtos.JobDraftRequest;
import jobradarbackend.jobradar.user.User;
import jobradarbackend.jobradar.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.security.Principal;
import java.util.Map;

/**
 * IA de l'espace recruteur (chemins /api/recruiter/** : réservés aux rôles RECRUITER et ADMIN).
 *  POST /api/recruiter/applications/{id}/ai-insight   résumé IA d'un candidat
 *  POST /api/recruiter/ai/job-drafts                  brouillon d'offre à partir de quelques lignes
 */
@RestController
@RequestMapping("/api/recruiter")
@RequiredArgsConstructor
public class RecruiterAiController {

    private final ApplicantInsightService insights;
    private final JobDraftService drafts;
    private final UserRepository users;

    @PostMapping("/applications/{id}/ai-insight")
    public ApplicantInsight insight(@PathVariable Long id, Principal principal) {
        return insights.insight(currentUserId(principal), id);
    }

    @PostMapping("/ai/job-drafts")
    public JobDraft draft(@Valid @RequestBody JobDraftRequest request, Principal principal) {
        return drafts.draft(currentUserId(principal), request);
    }

    private Long currentUserId(Principal principal) {
        if (principal == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Connexion requise.");
        return users.findByEmail(principal.getName()).map(User::getId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Utilisateur introuvable."));
    }

    // ── Erreurs : { status, message } comme le reste de l'espace recruteur ──

    @ExceptionHandler(AiException.class)
    public ResponseEntity<Map<String, Object>> handleAi(AiException e) {
        return ResponseEntity.status(e.getReason().status)
                .body(Map.of("status", e.getReason().status.value(), "code", e.getReason().name(), "message", e.getMessage()));
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, Object>> handleStatus(ResponseStatusException e) {
        return ResponseEntity.status(e.getStatusCode())
                .body(Map.of("status", e.getStatusCode().value(), "message", String.valueOf(e.getReason())));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidation(MethodArgumentNotValidException e) {
        boolean brief = e.getBindingResult().getFieldErrors().stream().anyMatch(f -> "brief".equals(f.getField()));
        return ResponseEntity.badRequest().body(Map.of("status", 400, "message", brief
                ? "Décrivez le poste en quelques lignes (20 à 1500 caractères)."
                : "Certaines informations sont invalides."));
    }
}
