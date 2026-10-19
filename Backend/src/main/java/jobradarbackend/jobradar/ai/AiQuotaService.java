package jobradarbackend.jobradar.ai;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;


@Service
@RequiredArgsConstructor
public class AiQuotaService {

    private final AiProperties props;

    /** clé « idCandidat:date » → nombre de générations */
    private final Map<String, Integer> usage = new ConcurrentHashMap<>();

    /** Réserve une génération ; lève QUOTA_EXCEEDED si la limite du jour est atteinte */
    public void consume(Long candidateId) {
        String key = key(candidateId);
        int limit = props.getDailyLimitPerUser();
        Integer after = usage.merge(key, 1, Integer::sum);
        if (after > limit) {
            usage.merge(key, -1, Integer::sum);
            throw new AiException(AiException.Reason.QUOTA_EXCEEDED,
                    "Limite de " + limit + " générations par jour atteinte. Revenez demain.");
        }
        purgeOldDays();
    }

    /** Rend une génération si l'appel à l'IA a échoué (l'utilisateur ne la perd pas) */
    public void refund(Long candidateId) {
        usage.computeIfPresent(key(candidateId), (k, v) -> v > 1 ? v - 1 : null);
    }

    public int used(Long candidateId) {
        return usage.getOrDefault(key(candidateId), 0);
    }

    public int remaining(Long candidateId) {
        return Math.max(0, props.getDailyLimitPerUser() - used(candidateId));
    }

    public int limit() {
        return props.getDailyLimitPerUser();
    }

    private String key(Long candidateId) {
        return candidateId + ":" + LocalDate.now();
    }

    private void purgeOldDays() {
        String today = ":" + LocalDate.now();
        usage.keySet().removeIf(k -> !k.endsWith(today));
    }
}