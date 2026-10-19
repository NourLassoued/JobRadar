package jobradarbackend.jobradar.matching;

import jobradarbackend.jobradar.candidate.SectorType;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/**
 * Stratégie standard : compétences 60 %, expérience 20 %, secteur 20 %.
 * S'applique à tous les secteurs ; elle est choisie en dernier (Ordered.LOWEST_PRECEDENCE)
 * pour qu'une stratégie spécifique à un secteur puisse passer avant elle.
 */
@Component
@Order(Ordered.LOWEST_PRECEDENCE)
public class DefaultMatchingStrategy extends AbstractMatchingStrategy {

    private static final MatchingWeights WEIGHTS = new MatchingWeights(0.60, 0.20, 0.20);

    @Override
    public String name() {
        return "Standard 60/20/20";
    }

    @Override
    public boolean supports(SectorType offerSector) {
        return true;
    }

    @Override
    public MatchingWeights weights() {
        return WEIGHTS;
    }
}