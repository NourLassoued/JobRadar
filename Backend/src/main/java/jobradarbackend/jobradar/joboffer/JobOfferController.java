package jobradarbackend.jobradar.joboffer;

import jakarta.validation.Valid;
import jobradarbackend.jobradar.candidate.Candidate;
import jobradarbackend.jobradar.candidate.CandidateRepository;
import jobradarbackend.jobradar.candidate.SectorType;
import jobradarbackend.jobradar.joboffer.DtoJoboffer.JobOfferRequest;
import jobradarbackend.jobradar.joboffer.DtoJoboffer.JobOfferResponse;
import jobradarbackend.jobradar.user.User;
import jobradarbackend.jobradar.user.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Slf4j
@RestController
@RequestMapping("/api/job-offers")
@RequiredArgsConstructor
public class JobOfferController {

    private final JobOfferService service;
    private final CandidateRepository candidateRepository;
    private final UserRepository userRepository;


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
    @GetMapping("/recommended")
    public ResponseEntity<List<JobOfferResponse>> getRecommendedOffers() {
        Candidate currentCandidate = getCurrentCandidate();
        return ResponseEntity.ok(service.findRecommendedOffers(currentCandidate));
    }

    /**
     * GET /api/job-offers/user-sector
     * Alias pour /recommended
     */
    @GetMapping("/user-sector")
    public ResponseEntity<List<JobOfferResponse>> getOffersByUserSector() {
        return getRecommendedOffers();
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
    private Candidate getCurrentCandidate() {
        try {
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();

            if (auth != null && auth.isAuthenticated()) {
                if (auth.getPrincipal() instanceof Candidate) {
                    return (Candidate) auth.getPrincipal();
                }

                if (auth.getPrincipal() instanceof User) {
                    User user = (User) auth.getPrincipal();
                    return candidateRepository.findByUser(user).orElse(null);
                }

                String email = auth.getName();
                if (email != null && !email.isBlank()) {
                    return userRepository.findByEmail(email)
                            .flatMap(candidateRepository::findByUser)
                            .orElse(null);
                }
            }
        } catch (Exception e) {
            System.err.println("Erreur: " + e.getMessage());
        }
        return null;
    }
    @GetMapping("/by-sector")
    public ResponseEntity<List<JobOfferResponse>> getOffersBySector(  // ← CHANGEMENT 1
                                                                      @RequestParam(name = "sector", required = false) String sector) {

        log.info("Recherche offres par secteur: {}", sector);

        if (sector == null || sector.trim().isEmpty()) {
            log.info("⚠️ Secteur vide, retour de toutes les offres");
            return ResponseEntity.ok(service.findAll());
        }

        try {
            SectorType sectorType = SectorType.valueOf(sector.toUpperCase());
            List<JobOfferResponse> offers = service.getOffersBySectorAsResponses(sectorType);  // ← CHANGEMENT 2
            log.info("Trouvé {} offres pour secteur {}", offers.size(), sectorType);
            return ResponseEntity.ok(offers);
        } catch (IllegalArgumentException e) {
            log.error("Secteur invalide: {}", sector);
            return ResponseEntity.ok(List.of());
        }
    }}