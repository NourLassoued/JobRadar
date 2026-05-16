package jobradarbackend.jobradar.candidate;

import jakarta.validation.Valid;
import jobradarbackend.jobradar.candidate.dto.CandidateRequest;
import jobradarbackend.jobradar.candidate.dto.CandidateResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;


@RestController
@RequestMapping("/api/candidates")
@RequiredArgsConstructor
public class CandidateController {

    private final CandidateService service;

    @PostMapping
    public ResponseEntity<CandidateResponse> create(@Valid @RequestBody CandidateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(request));
    }

    @GetMapping
    public ResponseEntity<List<CandidateResponse>> findAll(
            @RequestParam(required = false) SectorType sector,
            @RequestParam(required = false) String city) {

        if (sector != null) {
            return ResponseEntity.ok(service.findBySector(sector));
        }
        if (city != null) {
            return ResponseEntity.ok(service.findByCity(city));
        }
        return ResponseEntity.ok(service.findAll());
    }

    @GetMapping("/active")
    public ResponseEntity<List<CandidateResponse>> findActive() {
        return ResponseEntity.ok(service.findActiveCandidates());
    }

    @GetMapping("/{id}")
    public ResponseEntity<CandidateResponse> findById(@PathVariable Long id) {
        return ResponseEntity.ok(service.findById(id));
    }

    @PutMapping("/{id}")
    public ResponseEntity<CandidateResponse> update(
            @PathVariable Long id,
            @Valid @RequestBody CandidateRequest request) {
        return ResponseEntity.ok(service.update(id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/{id}/archive")
    public ResponseEntity<CandidateResponse> archive(@PathVariable Long id) {
        return ResponseEntity.ok(service.archive(id));
    }
}