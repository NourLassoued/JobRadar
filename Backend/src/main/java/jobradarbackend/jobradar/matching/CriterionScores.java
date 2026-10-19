package jobradarbackend.jobradar.matching;

import java.util.List;

/**
 * Note de chaque critère, entre 0 et 1, avant pondération.
 *
 * @param matchedSkills compétences du candidat trouvées dans l'offre (orthographe du candidat)
 * @param requiredYears années d'expérience demandées par l'offre (null si non précisé)
 * @param offerSkills   technologies repérées dans l'offre (dictionnaire SkillDictionary)
 * @param missingSkills technologies de l'offre absentes du profil
 */
public record CriterionScores(
        double skills,
        double experience,
        double sector,
        List<String> matchedSkills,
        Integer requiredYears,
        List<String> offerSkills,
        List<String> missingSkills
) {}