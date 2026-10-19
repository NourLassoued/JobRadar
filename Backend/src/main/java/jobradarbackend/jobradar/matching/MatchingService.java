package jobradarbackend.jobradar.matching;

import jobradarbackend.jobradar.candidate.Candidate;
import jobradarbackend.jobradar.joboffer.JobOffer;
import jobradarbackend.jobradar.joboffer.JobOfferRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * Calcule le score de correspondance candidat ↔ offre.
 * Ne connaît que l'interface MatchingStrategy : la stratégie est choisie selon le secteur de l'offre.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MatchingService {

    private final MatchingStrategyResolver resolver;
    private final JobOfferRepository jobOfferRepository;

    /** Score d'une offre pour un candidat */
    public MatchResult score(Candidate candidate, JobOffer offer) {
        MatchingStrategy strategy = resolver.resolve(offer.getSector());
        MatchingWeights w = strategy.weights();
        CriterionScores c = strategy.evaluate(candidate, offer);

        double total = c.skills() * w.skills() + c.experience() * w.experience() + c.sector() * w.sector();

        return new MatchResult(
                offer.getId(),
                offer.getTitle(),
                offer.getCompany(),
                toPercent(total),
                toPercent(c.skills()),
                toPercent(c.experience()),
                toPercent(c.sector()),
                c.matchedSkills(),
                c.offerSkills(),
                c.missingSkills(),
                c.requiredYears(),
                strategy.name(),
                w,
                reasons(candidate, c));
    }

    /**
     * Les meilleures offres actives du secteur du candidat, triées par score décroissant.
     * Sans secteur renseigné, on parcourt toutes les offres actives (plus lent).
     */
    @Transactional(readOnly = true)
    public List<MatchResult> topMatches(Candidate candidate, int limit) {
        List<JobOffer> offers = candidate.getSector() != null
                ? jobOfferRepository.findBySectorAndIsActiveTrue(candidate.getSector().name())
                : jobOfferRepository.findByIsActiveTrue();

        log.info("Matching : {} offres évaluées pour le candidat {}", offers.size(), candidate.getId());

        return offers.stream()
                .map(offer -> score(candidate, offer))
                .sorted(Comparator.comparingInt(MatchResult::score).reversed())
                .limit(Math.max(1, Math.min(limit, 50)))
                .toList();
    }

    // ── Utilitaires ────────────────────────────────────────────

    private int toPercent(double value) {
        return (int) Math.round(Math.max(0, Math.min(1, value)) * 100);
    }

    /** Explications lisibles, à afficher sous le score */
    private List<String> reasons(Candidate candidate, CriterionScores c) {
        List<String> reasons = new ArrayList<>();

        int total = candidate.getSkills() == null ? 0 : candidate.getSkills().size();
        if (total == 0) {
            reasons.add("Ajoutez vos compétences au profil pour un score plus précis.");
        } else if (c.matchedSkills().isEmpty()) {
            reasons.add("Aucune de vos compétences n'est citée dans l'offre.");
        } else {
            reasons.add(c.matchedSkills().size() + " compétence" + (c.matchedSkills().size() > 1 ? "s" : "")
                    + " en commun : " + String.join(", ", c.matchedSkills()) + ".");
        }

        // Part de l'offre couverte (seulement si l'offre cite assez de technologies)
        int offerTotal = c.offerSkills().size();
        if (offerTotal >= 3) {
            int covered = offerTotal - c.missingSkills().size();
            reasons.add("Vous maîtrisez " + covered + " des " + offerTotal + " technologies citées dans l'offre.");
            if (!c.missingSkills().isEmpty()) {
                List<String> shown = c.missingSkills().stream().limit(5).toList();
                int more = c.missingSkills().size() - shown.size();
                reasons.add("À renforcer : " + String.join(", ", shown) + (more > 0 ? " (+" + more + ")" : "") + ".");
            }
        }

        if (c.requiredYears() == null || c.requiredYears() == 0) {
            reasons.add("Aucune expérience minimale exigée.");
        } else if (candidate.getYearsOfExperience() == null) {
            reasons.add(c.requiredYears() + " an(s) d'expérience demandé(s) ; renseignez la vôtre dans le profil.");
        } else if (candidate.getYearsOfExperience() >= c.requiredYears()) {
            reasons.add("Votre expérience couvre les " + c.requiredYears() + " an(s) demandé(s).");
        } else {
            reasons.add(c.requiredYears() + " an(s) d'expérience demandé(s), vous en avez " + candidate.getYearsOfExperience() + ".");
        }

        if (c.sector() == 1.0) reasons.add("L'offre est dans votre secteur.");
        else if (c.sector() == 0.0) reasons.add("L'offre est hors de votre secteur.");

        return reasons;
    }
}