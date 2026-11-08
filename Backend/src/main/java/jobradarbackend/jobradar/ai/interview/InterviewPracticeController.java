package jobradarbackend.jobradar.ai.interview;

import jakarta.validation.Valid;
import jobradarbackend.jobradar.ai.AiException;
import jobradarbackend.jobradar.ai.interview.InterviewPracticeDtos.AnswerFeedback;
import jobradarbackend.jobradar.ai.interview.InterviewPracticeDtos.AnswerRequest;
import jobradarbackend.jobradar.candidate.CurrentCandidateResolver;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.security.Principal;
import java.util.Map;

/**
 * POST /api/ai/interview-answers — évalue la réponse du candidat à une question d'entretien.
 */
@RestController
@RequestMapping("/api/ai/interview-answers")
@RequiredArgsConstructor
public class InterviewPracticeController {

    private final InterviewPracticeService service;
    private final CurrentCandidateResolver current;

    @PostMapping
    public AnswerFeedback evaluate(@Valid @RequestBody AnswerRequest request, Principal principal) {
        return service.evaluate(current.candidateId(principal), request);
    }

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
        boolean tooShort = e.getBindingResult().getFieldErrors().stream()
                .anyMatch(f -> "answer".equals(f.getField()));
        return ResponseEntity.badRequest().body(Map.of("status", 400, "message", tooShort
                ? "Votre réponse est trop courte (15 caractères minimum) ou trop longue (5000 maximum)."
                : "Question ou offre manquante."));
    }
}
