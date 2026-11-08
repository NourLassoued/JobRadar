package jobradarbackend.jobradar.ai.explain;

import jakarta.validation.Valid;
import jobradarbackend.jobradar.ai.AiException;
import jobradarbackend.jobradar.ai.explain.ScoreExplanationDtos.ExplainRequest;
import jobradarbackend.jobradar.ai.explain.ScoreExplanationDtos.ScoreExplanation;
import jobradarbackend.jobradar.candidate.CurrentCandidateResolver;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.security.Principal;
import java.util.Map;

/**
 * POST /api/ai/score-explanations   { "jobOfferId": 123 }
 * Explication IA du score de compatibilité pour le candidat connecté.
 */
@RestController
@RequestMapping("/api/ai/score-explanations")
@RequiredArgsConstructor
public class ScoreExplanationController {

    private final ScoreExplanationService service;
    private final CurrentCandidateResolver current;

    @PostMapping
    public ScoreExplanation explain(@Valid @RequestBody ExplainRequest request, Principal principal) {
        return service.explain(current.candidateId(principal), request.jobOfferId());
    }

    // ── Erreurs en JSON lisible par le front (même format que AiController) ──

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
}
