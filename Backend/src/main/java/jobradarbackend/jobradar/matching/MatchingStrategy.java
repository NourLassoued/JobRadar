package jobradarbackend.jobradar.matching;

import jobradarbackend.jobradar.candidate.Candidate;
import jobradarbackend.jobradar.candidate.SectorType;
import jobradarbackend.jobradar.joboffer.JobOffer;


public interface MatchingStrategy {

    /** Nom affiché dans le résultat (ex. « Standard 60/20/20 ») */
    String name();

    /** La stratégie s'applique-t-elle aux offres de ce secteur ? */
    boolean supports(SectorType offerSector);

    /** Pondérations des trois critères (somme = 1) */
    MatchingWeights weights();

    /** Note de chaque critère, entre 0 et 1 */
    CriterionScores evaluate(Candidate candidate, JobOffer offer);
}