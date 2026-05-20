package jobradarbackend.jobradar.matching;

import jobradarbackend.jobradar.candidate.Candidate;
import jobradarbackend.jobradar.candidate.CandidateRepository;
import jobradarbackend.jobradar.joboffer.JobOffer;
import jobradarbackend.jobradar.joboffer.JobOfferRepository;
import jobradarbackend.jobradar.joboffer.DtoJoboffer.JobOfferResponse;
import jobradarbackend.jobradar.matching.matchingDto.MatchScore;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;


@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class MatchingService {

    private final CandidateRepository candidateRepository;
    private final JobOfferRepository jobOfferRepository;


    public List<MatchScore> findBestMatchesForCandidate(Long candidateId) {
        log.info(" Calcul du matching pour le candidat ID : {}", candidateId);


        Candidate candidate = candidateRepository.findById(candidateId)
                .orElseThrow(() -> new IllegalArgumentException(
                        "Candidat introuvable avec l'ID : " + candidateId
                ));


        List<JobOffer> activeOffers = jobOfferRepository.findByIsActiveTrue();
        log.info(" {} offres actives à évaluer", activeOffers.size());

        List<MatchScore> matches = activeOffers.stream()
                .map(offer -> calculateScore(candidate, offer))
                .sorted(Comparator.comparingInt(MatchScore::getTotalScore).reversed())
                .toList();

        log.info(" {} offres scorées et triées", matches.size());
        return matches;
    }


    public MatchScore calculateMatchForOffer(Long candidateId, Long offerId) {
        Candidate candidate = candidateRepository.findById(candidateId)
                .orElseThrow(() -> new IllegalArgumentException(
                        "Candidat introuvable : " + candidateId
                ));

        JobOffer offer = jobOfferRepository.findById(offerId)
                .orElseThrow(() -> new IllegalArgumentException(
                        "Offre introuvable : " + offerId
                ));

        return calculateScore(candidate, offer);
    }


    private MatchScore calculateScore(Candidate candidate, JobOffer offer) {

        // 1. Calcul des scores par critère
        int sectorScore = scoreSector(candidate, offer);           // 0-40
        int locationScore = scoreLocation(candidate, offer);       // 0-20
        int experienceScore = scoreExperience(candidate, offer);   // 0-20
        int salaryScore = scoreSalary(candidate, offer);           // 0-10
        int remoteScore = scoreRemote(candidate, offer);           // 0-10

        // 2. Total
        int totalScore = sectorScore + locationScore + experienceScore + salaryScore + remoteScore;

        // 3. Niveau de match
        MatchScore.MatchLevel level = determineLevel(totalScore);

        // 4. Forces et faiblesses
        List<String> strengths = identifyStrengths(candidate, offer,
                sectorScore, locationScore, experienceScore, salaryScore, remoteScore);
        List<String> weaknesses = identifyWeaknesses(candidate, offer,
                sectorScore, locationScore, experienceScore, salaryScore, remoteScore);

        // 5. Construire le résultat
        return MatchScore.builder()
                .jobOffer(JobOfferResponse.fromEntity(offer))
                .totalScore(totalScore)
                .matchLevel(level)
                .breakdown(MatchScore.ScoreBreakdown.builder()
                        .sectorScore(sectorScore)
                        .locationScore(locationScore)
                        .experienceScore(experienceScore)
                        .salaryScore(salaryScore)
                        .remoteScore(remoteScore)
                        .build())
                .strengths(strengths)
                .weaknesses(weaknesses)
                .build();
    }

    // ============================================================
    // SCORING PAR CRITÈRE
    // ============================================================

    /**
     * Score secteur (0-40 points).
     * Match exact = 40 points, sinon = 0.
     */
    private int scoreSector(Candidate candidate, JobOffer offer) {
        if (candidate.getSector() == null || offer.getSector() == null) {
            return 0;
        }
        // Comparaison du nom de l'enum candidat avec le string secteur de l'offre
        if (candidate.getSector().name().equalsIgnoreCase(offer.getSector())) {
            return 40;
        }
        return 0;
    }


    private int scoreLocation(Candidate candidate, JobOffer offer) {
        if (candidate.getCity() == null || offer.getLocation() == null) {
            return 0;
        }
        if (candidate.getCity().equalsIgnoreCase(offer.getLocation())) {
            return 20;
        }
        // Pas la même ville mais télétravail possible
        if (offer.getRemote() != null && offer.getRemote()) {
            return 15;
        }
        return 5;  // Pas idéal mais pas éliminatoire
    }


    private int scoreExperience(Candidate candidate, JobOffer offer) {
        if (candidate.getYearsOfExperience() == null) {
            return 10;
        }
        int years = candidate.getYearsOfExperience();
        if (years >= 5) return 20;
        if (years >= 3) return 16;
        if (years >= 1) return 12;
        return 8;
    }


    private int scoreSalary(Candidate candidate, JobOffer offer) {
        BigDecimal expected = candidate.getExpectedSalary();
        BigDecimal min = offer.getSalaryMin();
        BigDecimal max = offer.getSalaryMax();

        if (expected == null || min == null || max == null) {
            return 5;
        }

        if (expected.compareTo(min) >= 0 && expected.compareTo(max) <= 0) {
            return 10;
        }
        if (expected.compareTo(min) < 0) {
            return 8;
        }
        BigDecimal overrun = expected.subtract(max);
        BigDecimal percent = overrun.divide(max, 2, java.math.RoundingMode.HALF_UP);

        if (percent.compareTo(new BigDecimal("0.30")) > 0) {
            return 0;
        }
        return 5;
    }


    private int scoreRemote(Candidate candidate, JobOffer offer) {
        Boolean candidateWantsRemote = candidate.getRemotePreference();
        Boolean offerIsRemote = offer.getRemote();

        if (candidateWantsRemote == null || offerIsRemote == null) {
            return 5;
        }

        if (candidateWantsRemote && offerIsRemote) {
            return 10;
        }
        if (!candidateWantsRemote && !offerIsRemote) {
            return 10;
        }
        return 3;
    }


    private MatchScore.MatchLevel determineLevel(int totalScore) {
        if (totalScore >= 80) return MatchScore.MatchLevel.EXCELLENT;
        if (totalScore >= 60) return MatchScore.MatchLevel.GOOD;
        if (totalScore >= 40) return MatchScore.MatchLevel.AVERAGE;
        return MatchScore.MatchLevel.POOR;
    }


    private List<String> identifyStrengths(Candidate candidate, JobOffer offer,
                                           int sectorScore, int locationScore,
                                           int experienceScore, int salaryScore,
                                           int remoteScore) {
        List<String> strengths = new ArrayList<>();

        if (sectorScore == 40) {
            strengths.add(" Secteur parfaitement aligné : " + offer.getSector());
        }
        if (locationScore == 20) {
            strengths.add(" Même ville : " + offer.getLocation());
        }
        if (experienceScore >= 16) {
            strengths.add("Expérience adaptée : " + candidate.getYearsOfExperience() + " ans");
        }
        if (salaryScore == 10) {
            strengths.add("Salaire dans la fourchette attendue");
        }
        if (remoteScore == 10 && Boolean.TRUE.equals(offer.getRemote())) {
            strengths.add(" Télétravail disponible (comme souhaité)");
        }

        return strengths;
    }

    private List<String> identifyWeaknesses(Candidate candidate, JobOffer offer,
                                            int sectorScore, int locationScore,
                                            int experienceScore, int salaryScore,
                                            int remoteScore) {
        List<String> weaknesses = new ArrayList<>();

        if (sectorScore == 0) {
            weaknesses.add(" Secteurs différents : " +
                    (candidate.getSector() != null ? candidate.getSector() : "non défini") +
                    " vs " + offer.getSector());
        }
        if (locationScore <= 5) {
            weaknesses.add(" Ville différente : " +
                    candidate.getCity() + " vs " + offer.getLocation());
        }
        if (salaryScore == 0) {
            weaknesses.add(" Salaire demandé trop élevé pour cette offre");
        }
        if (remoteScore == 3) {
            weaknesses.add("⚠ Préférence télétravail non alignée avec l'offre");
        }

        return weaknesses;
    }
}