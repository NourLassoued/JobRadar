package jobradarbackend.jobradar.matching;

import jobradarbackend.jobradar.candidate.SectorType;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Locale;

/**
 * Choisit la stratégie à appliquer selon le secteur de l'offre.
 * Spring injecte toutes les MatchingStrategy, triées par @Order :
 * les stratégies spécifiques d'abord, la stratégie standard en dernier.
 */
@Component
public class MatchingStrategyResolver {

    private final List<MatchingStrategy> strategies;

    public MatchingStrategyResolver(List<MatchingStrategy> strategies) {
        this.strategies = strategies;
    }

    public MatchingStrategy resolve(String offerSector) {
        SectorType sector = toSector(offerSector);
        return strategies.stream()
                .filter(s -> s.supports(sector))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("Aucune stratégie de matching disponible."));
    }

    private SectorType toSector(String value) {
        if (value == null || value.isBlank()) return SectorType.OTHER;
        try {
            return SectorType.valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            return SectorType.OTHER;
        }
    }
}