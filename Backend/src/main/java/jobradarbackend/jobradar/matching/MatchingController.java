package jobradarbackend.jobradar.matching;

import jobradarbackend.jobradar.candidate.Candidate;
import jobradarbackend.jobradar.candidate.CandidateRepository;
import jobradarbackend.jobradar.joboffer.JobOffer;
import jobradarbackend.jobradar.joboffer.JobOfferRepository;
import jobradarbackend.jobradar.user.User;
import jobradarbackend.jobradar.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.security.Principal;
import java.util.List;

/**
 * Matching pour le candidat connecté (identifié par le JWT).
 */
@RestController
@RequestMapping("/api/matching")
@RequiredArgsConstructor
public class MatchingController {

    private final MatchingService matchingService;
    private final JobOfferRepository jobOfferRepository;
    private final CandidateRepository candidateRepository;
    private final UserRepository userRepository;

    /** GET /api/matching/offers/{offerId} — score détaillé d'une offre */
    @GetMapping("/offers/{offerId:\\d+}")
    @Transactional(readOnly = true)
    public MatchResult scoreOffer(@PathVariable Long offerId, Principal principal) {
        Candidate candidate = currentCandidate(principal);
        JobOffer offer = jobOfferRepository.findById(offerId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Offre introuvable : " + offerId));
        return matchingService.score(candidate, offer);
    }

    /**
     * POST /api/matching/offers/scores — scores de plusieurs offres en une requête.
     * Corps : [16777, 16778, …] (100 identifiants maximum). Utilisé par la liste des offres.
     */
    @PostMapping(value = "/offers/scores", consumes = "application/json")
    @Transactional(readOnly = true)
    public List<MatchResult> scoreOffers(@RequestBody(required = false) List<Long> offerIds, Principal principal) {
        Candidate candidate = currentCandidate(principal);
        List<Long> ids = offerIds == null ? List.of()
                : offerIds.stream().filter(java.util.Objects::nonNull).distinct().limit(100).toList();
        if (ids.isEmpty()) return List.of();

        return jobOfferRepository.findAllById(ids).stream()
                .map(offer -> matchingService.score(candidate, offer))
                .toList();
    }

    /** GET /api/matching/top?limit=10 — meilleures offres pour le candidat connecté */
    @GetMapping("/top")
    @Transactional(readOnly = true)
    public List<MatchResult> topMatches(@RequestParam(defaultValue = "10") int limit, Principal principal) {
        return matchingService.topMatches(currentCandidate(principal), limit);
    }

    private Candidate currentCandidate(Principal principal) {
        if (principal == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Connexion requise.");
        }
        User user = userRepository.findByEmail(principal.getName())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Utilisateur introuvable."));
        return candidateRepository.findByUserId(user.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Complétez votre profil candidat pour obtenir un score."));
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<java.util.Map<String, Object>> handle(ResponseStatusException e) {
        return ResponseEntity.status(e.getStatusCode())
                .body(java.util.Map.of("status", e.getStatusCode().value(), "message", String.valueOf(e.getReason())));
    }
}