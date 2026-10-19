package jobradarbackend.jobradar.cv;

import jakarta.validation.Valid;
import jobradarbackend.jobradar.ai.AiException;
import jobradarbackend.jobradar.candidate.CurrentCandidateResolver;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;
import java.util.Map;


@RestController
@RequestMapping("/api/cvs")
@RequiredArgsConstructor
public class CvController {

    private final CvService cvService;
    private final CurrentCandidateResolver current;

    @GetMapping
    public List<CvDtos.CvResponse> list(Principal principal) {
        return cvService.list(current.candidateId(principal));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public CvDtos.CvResponse create(@Valid @RequestBody CvDtos.CreateCvRequest request, Principal principal) {
        return cvService.create(current.candidateId(principal), request);
    }

    @PatchMapping("/{id}/default")
    public CvDtos.CvResponse setDefault(@PathVariable Long id, Principal principal) {
        return cvService.setDefault(current.candidateId(principal), id);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id, Principal principal) {
        cvService.delete(current.candidateId(principal), id);
    }

    @ExceptionHandler(AiException.class)
    public ResponseEntity<Map<String, Object>> handle(AiException e) {
        return ResponseEntity.status(e.getReason().status)
                .body(Map.of("status", e.getReason().status.value(), "code", e.getReason().name(), "message", e.getMessage()));
    }
}