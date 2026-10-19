package jobradarbackend.jobradar.matching.recommendation;

import jobradarbackend.jobradar.candidate.Candidate;
import jobradarbackend.jobradar.candidate.SectorType;
import jobradarbackend.jobradar.joboffer.JobOffer;
import jobradarbackend.jobradar.joboffer.JobOfferRepository;
import jobradarbackend.jobradar.matching.MatchResult;
import jobradarbackend.jobradar.matching.MatchingService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;
import java.util.stream.Stream;


@Slf4j
@Service
@RequiredArgsConstructor
public class RecommendationService {

    private final JobOfferRepository jobOfferRepository;
    private final MatchingService matchingService;

    public record ScoredOffer(JobOffer offer, MatchResult match) {}


    @Transactional(readOnly = true)
    public List<ScoredOffer> recommend(Candidate candidate, Integer limit) {
        SectorType sector = candidate.getSector();
        boolean hasSector = sector != null && sector != SectorType.OTHER;

        List<JobOffer> offers = hasSector
                ? jobOfferRepository.findBySectorAndIsActiveTrue(sector.name())
                : jobOfferRepository.findByIsActiveTrue();

        long start = System.currentTimeMillis();
        Stream<ScoredOffer> sorted = offers.stream()
                .map(offer -> new ScoredOffer(offer, matchingService.score(candidate, offer)))
                .sorted(Comparator
                        .comparingInt((ScoredOffer s) -> s.match().score()).reversed()
                        .thenComparing(s -> s.offer().getId(), Comparator.nullsLast(Comparator.reverseOrder())));

        List<ScoredOffer> result = (limit != null && limit > 0 ? sorted.limit(limit) : sorted).toList();

        log.info("Recommandations : {} offres {} notées en {} ms, {} renvoyées",
                offers.size(), hasSector ? "du secteur " + sector : "(tous secteurs)",
                System.currentTimeMillis() - start, result.size());
        return result;
    }
}