package jobradarbackend.jobradar.matching;

import java.util.List;

/**
 * Résultat du matching entre un candidat et une offre.
 *
 * @param score         score global de 0 à 100
 * @param skillsScore   note du critère compétences, de 0 à 100 (avant pondération)
 * @param matchedSkills compétences du candidat trouvées dans l'offre
 * @param offerSkills   technologies repérées dans l'offre
 * @param missingSkills technologies de l'offre que le candidat n'a pas dans son profil
 * @param strategy      nom de la stratégie appliquée
 * @param reasons       explications lisibles, affichables au candidat
 */
public record MatchResult(
        Long offerId,
        String title,
        String company,
        int score,
        int skillsScore,
        int experienceScore,
        int sectorScore,
        List<String> matchedSkills,
        List<String> offerSkills,
        List<String> missingSkills,
        Integer requiredYears,
        String strategy,
        MatchingWeights weights,
        List<String> reasons
) {}