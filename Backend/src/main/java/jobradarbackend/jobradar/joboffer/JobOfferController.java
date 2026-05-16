package jobradarbackend.jobradar.joboffer;

import jakarta.validation.Valid;
import jobradarbackend.jobradar.joboffer.DtoJoboffer.JobOfferRequest;
import jobradarbackend.jobradar.joboffer.DtoJoboffer.JobOfferResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;


@RestController
@RequestMapping("/api/job-offers")
@RequiredArgsConstructor
public class JobOfferController {

    private final JobOfferService service;


    @PostMapping
    public ResponseEntity<JobOfferResponse> create(@Valid @RequestBody JobOfferRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(request));
    }


    @GetMapping
    public ResponseEntity<List<JobOfferResponse>> findAll(
            @RequestParam(required = false) String sector,
            @RequestParam(required = false) String location,
            @RequestParam(required = false) ContractType contractType) {

        // Filtrage selon les paramètres
        if (sector != null) {
            return ResponseEntity.ok(service.findBySector(sector));
        }
        if (location != null) {
            return ResponseEntity.ok(service.findByLocation(location));
        }
        if (contractType != null) {
            return ResponseEntity.ok(service.findByContractType(contractType));
        }
        return ResponseEntity.ok(service.findAll());
    }

    @GetMapping("/remote")
    public ResponseEntity<List<JobOfferResponse>> findRemoteOffers() {
        return ResponseEntity.ok(service.findRemoteOffers());
    }

    @GetMapping("/active")
    public ResponseEntity<List<JobOfferResponse>> findActiveOffers() {
        return ResponseEntity.ok(service.findActiveOffers());
    }

    @GetMapping("/{id}")
    public ResponseEntity<JobOfferResponse> findById(@PathVariable Long id) {
        return ResponseEntity.ok(service.findById(id));
    }

    @PutMapping("/{id}")
    public ResponseEntity<JobOfferResponse> update(
            @PathVariable Long id,
            @Valid @RequestBody JobOfferRequest request) {
        return ResponseEntity.ok(service.update(id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }


    @PatchMapping("/{id}/archive")
    public ResponseEntity<JobOfferResponse> archive(@PathVariable Long id) {
        return ResponseEntity.ok(service.archive(id));
    }
}