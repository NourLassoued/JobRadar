package jobradarbackend.jobradar.matching;

import jobradarbackend.jobradar.candidate.Candidate;
import jobradarbackend.jobradar.candidate.SectorType;
import jobradarbackend.jobradar.joboffer.JobOffer;
import jobradarbackend.jobradar.matching.recommendation.SkillDictionary;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Calcul commun des trois critères. Une stratégie concrète choisit ses pondérations
 * et peut redéfinir une méthode de notation (ex. une stratégie Santé plus exigeante sur l'expérience).
 *
 * Critère compétences, calculé dans les deux sens :
 *  - côté profil : quelle part de VOS compétences l'offre cite ;
 *  - côté offre  : quelle part des technologies DE L'OFFRE vous maîtrisez.
 * La note finale est la moyenne des deux. Si l'offre cite moins de 3 technologies connues
 * (métiers hors tech, description courte), seul le côté profil compte.
 */
public abstract class AbstractMatchingStrategy implements MatchingStrategy {

    /** Côté profil : nombre de compétences trouvées pour obtenir la note maximale */
    protected static final int SKILLS_FOR_FULL_SCORE = 5;
    /** Côté offre : à partir de combien de technologies repérées on en tient compte */
    protected static final int MIN_OFFER_SKILLS = 3;
    /** Côté offre : nombre de technologies couvertes pour la note maximale (offres « catalogue ») */
    protected static final int OFFER_SKILLS_FOR_FULL_SCORE = 10;

    @Override
    public CriterionScores evaluate(Candidate candidate, JobOffer offer) {
        String text = OfferTextAnalyzer.offerText(offer);
        List<String> candidateSkills = distinctSkills(candidate);

        List<String> matched = matchedSkills(candidateSkills, text);
        List<String> offerSkills = SkillDictionary.detect(text);
        List<String> missing = missingSkills(candidateSkills, offerSkills);
        Integer requiredYears = OfferTextAnalyzer.requiredYears(text);

        return new CriterionScores(
                skillsScore(candidateSkills.size(), matched.size(), offerSkills.size(), offerSkills.size() - missing.size()),
                experienceScore(candidate.getYearsOfExperience(), requiredYears),
                sectorScore(candidate.getSector(), offer.getSector()),
                matched,
                requiredYears,
                offerSkills,
                missing);
    }

    // ── Compétences ────────────────────────────────────────────

    /** Compétences du candidat, sans doublons ni valeurs vides */
    protected List<String> distinctSkills(Candidate candidate) {
        if (candidate.getSkills() == null) return List.of();
        Set<String> seen = new LinkedHashSet<>();
        List<String> result = new ArrayList<>();
        for (String skill : candidate.getSkills()) {
            if (skill == null || skill.isBlank()) continue;
            String key = SkillDictionary.canonical(skill).orElse(OfferTextAnalyzer.normalize(skill));
            if (seen.add(key)) result.add(skill.trim());
        }
        return result;
    }

    /**
     * Compétences du candidat citées dans l'offre.
     * Une technologie connue est cherchée sous tous ses noms (« Postgres » trouve « PostgreSQL ») ;
     * une compétence libre (« Relation client ») est cherchée telle quelle.
     */
    protected List<String> matchedSkills(List<String> candidateSkills, String normalizedOfferText) {
        List<String> matched = new ArrayList<>();
        for (String skill : candidateSkills) {
            boolean found = SkillDictionary.canonical(skill)
                    .map(name -> SkillDictionary.mentions(normalizedOfferText, name))
                    .orElseGet(() -> OfferTextAnalyzer.containsSkill(normalizedOfferText, skill));
            if (found) matched.add(skill);
        }
        return matched;
    }

    /** Technologies de l'offre que le candidat n'a pas dans son profil */
    protected List<String> missingSkills(List<String> candidateSkills, List<String> offerSkills) {
        Set<String> owned = new LinkedHashSet<>();
        for (String skill : candidateSkills) SkillDictionary.canonical(skill).ifPresent(owned::add);
        return offerSkills.stream().filter(s -> !owned.contains(s)).toList();
    }

    /**
     * Moyenne de deux notes :
     *  - profil : trouvées / min(compétences du candidat, 5), plafonné à 1 ;
     *  - offre  : couvertes / min(technologies de l'offre, 10), plafonné à 1.
     * Moins de 3 technologies repérées dans l'offre → seule la note profil compte.
     */
    protected double skillsScore(int candidateTotal, int matched, int offerTotal, int covered) {
        if (candidateTotal == 0) return 0.0;
        double profileSide = Math.min(1.0, (double) matched / Math.min(candidateTotal, SKILLS_FOR_FULL_SCORE));
        if (offerTotal < MIN_OFFER_SKILLS) return profileSide;
        double offerSide = Math.min(1.0, (double) covered / Math.min(offerTotal, OFFER_SKILLS_FOR_FULL_SCORE));
        return (profileSide + offerSide) / 2;
    }

    // ── Expérience ─────────────────────────────────────────────

    /**
     * Pas d'exigence connue → 1 ; candidat sans expérience renseignée → 0.5 ;
     * sinon années du candidat / années demandées, plafonné à 1.
     */
    protected double experienceScore(Integer candidateYears, Integer requiredYears) {
        if (requiredYears == null || requiredYears == 0) return 1.0;
        if (candidateYears == null) return 0.5;
        return Math.min(1.0, (double) candidateYears / requiredYears);
    }

    // ── Secteur ────────────────────────────────────────────────

    /** Même secteur → 1 ; secteur du candidat inconnu → 0.5 ; différent → 0 */
    protected double sectorScore(SectorType candidateSector, String offerSector) {
        if (candidateSector == null || candidateSector == SectorType.OTHER) return 0.5;
        if (offerSector == null || offerSector.isBlank()) return 0.5;
        return candidateSector.name().equals(offerSector.trim().toUpperCase(Locale.ROOT)) ? 1.0 : 0.0;
    }
}