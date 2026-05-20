package jobradarbackend.jobradar.matching;

import jobradarbackend.jobradar.matching.matchingDto.MatchScore;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;


@RestController
@RequestMapping("/api/matching")
@RequiredArgsConstructor
public class MatchingController {

    private final MatchingService matchingService;


    @GetMapping("/candidate/{candidateId}")
    public ResponseEntity<List<MatchScore>> findBestMatches(@PathVariable Long candidateId) {
        return ResponseEntity.ok(matchingService.findBestMatchesForCandidate(candidateId));
    }

    @GetMapping("/candidate/{candidateId}/top/{limit}")
    public ResponseEntity<List<MatchScore>> findTopMatches(
            @PathVariable Long candidateId,
            @PathVariable Integer limit) {

        List<MatchScore> allMatches = matchingService.findBestMatchesForCandidate(candidateId);
        List<MatchScore> topMatches = allMatches.stream()
                .limit(limit)
                .toList();

        return ResponseEntity.ok(topMatches);
    }


    @GetMapping("/candidate/{candidateId}/offer/{offerId}")
    public ResponseEntity<MatchScore> calculateMatchForOffer(
            @PathVariable Long candidateId,
            @PathVariable Long offerId) {

        return ResponseEntity.ok(matchingService.calculateMatchForOffer(candidateId, offerId));
    }
}