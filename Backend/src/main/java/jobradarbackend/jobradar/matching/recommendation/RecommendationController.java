package jobradarbackend.jobradar.matching.recommendation;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jobradarbackend.jobradar.candidate.Candidate;
import jobradarbackend.jobradar.candidate.CandidateRepository;
import jobradarbackend.jobradar.user.User;
import jobradarbackend.jobradar.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.security.Principal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;


@RestController
@RequestMapping("/api/jobs")
@RequiredArgsConstructor
public class RecommendationController {

    private static final TypeReference<LinkedHashMap<String, Object>> MAP = new TypeReference<>() {};

    private final RecommendationService recommendationService;
    private final CandidateRepository candidateRepository;
    private final UserRepository userRepository;
    /** ObjectMapper de Spring : mêmes règles de sérialisation (dates…) que le reste de l'API */
    private final ObjectMapper objectMapper;

    @GetMapping("/recommended")
    public List<RecommendedOffer> recommended(@RequestParam(required = false) Integer limit, Principal principal) {
        Candidate candidate = currentCandidate(principal);

        return recommendationService.recommend(candidate, limit).stream()
                .map(s -> new RecommendedOffer(toFields(s.offer()), s.match()))
                .toList();
    }

    /** L'offre en champs JSON, sans dépendre d'un DTO particulier */
    private Map<String, Object> toFields(Object offer) {
        LinkedHashMap<String, Object> fields = objectMapper.convertValue(offer, MAP);
        // Le front attend « isActive » : Jackson écrit « active » si le getter est isActive()
        if (!fields.containsKey("isActive") && fields.containsKey("active")) {
            fields.put("isActive", fields.remove("active"));
        }
        return fields;
    }

    /** Candidat connecté ; un utilisateur sans profil reçoit toutes les offres avec un score neutre */
    private Candidate currentCandidate(Principal principal) {
        if (principal == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Connexion requise.");
        }
        User user = userRepository.findByEmail(principal.getName())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Utilisateur introuvable."));
        return candidateRepository.findByUserId(user.getId()).orElseGet(Candidate::new);
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, Object>> handle(ResponseStatusException e) {
        return ResponseEntity.status(e.getStatusCode())
                .body(Map.of("status", e.getStatusCode().value(), "message", String.valueOf(e.getReason())));
    }
}