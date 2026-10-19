package jobradarbackend.jobradar.ai;

import jakarta.validation.Valid;
import jobradarbackend.jobradar.ai.letter.CoverLetterService;
import jobradarbackend.jobradar.candidate.CurrentCandidateResolver;
import jobradarbackend.jobradar.cv.CvAdaptationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.security.Principal;
import java.util.List;
import java.util.Map;

/**
 * Fonctions IA du candidat connecté.
 *  POST  /api/ai/cv-adaptations               adapter un CV à une offre
 *  GET   /api/ai/cv-adaptations?jobOfferId=   adaptations déjà faites pour une offre
 *  PATCH /api/ai/cv-adaptations/{id}/status   accepter / rejeter
 *  POST  /api/ai/cover-letters                rédiger une lettre de motivation
 *  GET   /api/ai/quota                        générations restantes aujourd'hui
 */
@RestController
@RequestMapping("/api/ai")
@RequiredArgsConstructor
public class AiController {

    private final CvAdaptationService cvAdaptationService;
    private final CoverLetterService coverLetterService;
    private final AiQuotaService quota;
    private final CurrentCandidateResolver current;

    @PostMapping("/cv-adaptations")
    public AiDtos.CvAdaptationResponse adaptCv(@Valid @RequestBody AiDtos.AdaptCvRequest request, Principal principal) {
        return cvAdaptationService.adapt(current.candidateId(principal), request.jobOfferId(), request.cvId());
    }

    @GetMapping("/cv-adaptations")
    public List<AiDtos.CvAdaptationResponse> listAdaptations(@RequestParam Long jobOfferId, Principal principal) {
        return cvAdaptationService.listForOffer(current.candidateId(principal), jobOfferId);
    }

    @PatchMapping("/cv-adaptations/{id}/status")
    public AiDtos.CvAdaptationResponse updateStatus(@PathVariable Long id,
                                                    @Valid @RequestBody AiDtos.UpdateStatusRequest request,
                                                    Principal principal) {
        return cvAdaptationService.updateStatus(current.candidateId(principal), id, request.status());
    }

    @PostMapping("/cover-letters")
    public AiDtos.CoverLetterResponse coverLetter(@Valid @RequestBody AiDtos.CoverLetterRequest request, Principal principal) {
        return coverLetterService.generate(current.candidateId(principal), request);
    }

    @GetMapping("/quota")
    public AiDtos.QuotaResponse quota(Principal principal) {
        Long id = current.candidateId(principal);
        return new AiDtos.QuotaResponse(quota.limit(), quota.used(id), quota.remaining(id));
    }

    // ── Erreurs en JSON lisible par le front ─────────────────

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