package jobradarbackend.jobradar.ai;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Limite de générations IA par personne et par jour.
 *
 * Deux compteurs séparés : candidats (id candidat) et recruteurs (id utilisateur).
 * Les identifiants ne se mélangent jamais : « candidate:12 » et « recruiter:12 » sont deux personnes différentes.
 */
@Service
@RequiredArgsConstructor
public class AiQuotaService {

    private final AiProperties props;

    /** clé « type:id:date » → nombre de générations */
    private final Map<String, Integer> usage = new ConcurrentHashMap<>();

    // ── Candidats (API inchangée) ─────────────────────────────

    /** Réserve une génération ; lève QUOTA_EXCEEDED si la limite du jour est atteinte */
    public void consume(Long candidateId) {
        consumeFor(candidate(candidateId));
    }

    /** Rend une génération si l'appel à l'IA a échoué (l'utilisateur ne la perd pas) */
    public void refund(Long candidateId) {
        refundFor(candidate(candidateId));
    }

    public int used(Long candidateId) {
        return usedFor(candidate(candidateId));
    }

    public int remaining(Long candidateId) {
        return remainingFor(candidate(candidateId));
    }

    public int limit() {
        return props.getDailyLimitPerUser();
    }

    // ── Recruteurs ────────────────────────────────────────────

    public void consumeRecruiter(Long userId) {
        consumeFor(recruiter(userId));
    }

    public void refundRecruiter(Long userId) {
        refundFor(recruiter(userId));
    }

    public int remainingRecruiter(Long userId) {
        return remainingFor(recruiter(userId));
    }

    // ── Commun ────────────────────────────────────────────────

    private void consumeFor(String subject) {
        String key = key(subject);
        int limit = props.getDailyLimitPerUser();
        Integer after = usage.merge(key, 1, Integer::sum);
        if (after > limit) {
            usage.merge(key, -1, Integer::sum);
            throw new AiException(AiException.Reason.QUOTA_EXCEEDED,
                    "Limite de " + limit + " générations par jour atteinte. Revenez demain.");
        }
        purgeOldDays();
    }

    private void refundFor(String subject) {
        usage.computeIfPresent(key(subject), (k, v) -> v > 1 ? v - 1 : null);
    }

    private int usedFor(String subject) {
        return usage.getOrDefault(key(subject), 0);
    }

    private int remainingFor(String subject) {
        return Math.max(0, props.getDailyLimitPerUser() - usedFor(subject));
    }

    private static String candidate(Long id) {
        return "candidate:" + id;
    }

    private static String recruiter(Long id) {
        return "recruiter:" + id;
    }

    private String key(String subject) {
        return subject + ":" + LocalDate.now();
    }

    private void purgeOldDays() {
        String today = ":" + LocalDate.now();
        usage.keySet().removeIf(k -> !k.endsWith(today));
    }
}
