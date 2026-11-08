package jobradarbackend.jobradar.ai.explain;

import jobradarbackend.jobradar.ai.*;
import jobradarbackend.jobradar.ai.explain.ScoreExplanationDtos.Action;
import jobradarbackend.jobradar.ai.explain.ScoreExplanationDtos.ScoreExplanation;
import jobradarbackend.jobradar.candidate.Candidate;
import jobradarbackend.jobradar.candidate.CandidateRepository;
import jobradarbackend.jobradar.joboffer.JobOffer;
import jobradarbackend.jobradar.joboffer.JobOfferRepository;
import jobradarbackend.jobradar.matching.MatchResult;
import jobradarbackend.jobradar.matching.MatchingService;
import jobradarbackend.jobradar.matching.MatchingWeights;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.ConcurrentHashMap;

/**
 * « Pourquoi ce score ? » — l'IA explique le score de compatibilité en langage clair.
 *
 * Le score lui-même reste calculé par le moteur de matching (règles par secteur) : l'IA ne fait
 * qu'expliquer les chiffres qu'on lui donne et propose des actions honnêtes. Elle n'invente rien.
 *
 * Cache 24 h par candidat + offre + score : redemander la même explication ne consomme pas de génération.
 * Si le profil change (nouveau score ou nouvelles compétences), une nouvelle explication est produite.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ScoreExplanationService {

    private static final int MAX_OFFER_CHARS = 4_000;
    private static final Duration CACHE_TTL = Duration.ofHours(24);

    static final String SYSTEM_PROMPT = """
            Tu es un conseiller emploi bienveillant et précis. Tu expliques à un candidat
            le score de compatibilité entre son profil et une offre d'emploi.

            RÈGLES STRICTES :
            1. Le score est DÉJÀ calculé : ne le modifie pas, ne donne aucun autre pourcentage
               et n'invente aucun gain chiffré.
            2. Appuie-toi UNIQUEMENT sur les données fournies (scores des critères, compétences
               en commun, compétences manquantes, expérience, secteur, texte de l'offre).
            3. N'invente aucune expérience, aucun diplôme, aucune compétence.
            4. Actions honnêtes uniquement : apprendre une compétence, la mettre en avant si le candidat
               l'a déjà, compléter le profil, adapter le CV. Ne conseille JAMAIS d'ajouter une compétence
               que le candidat ne possède pas.
            5. Vouvoie le candidat. Phrases courtes, en français, sans jargon.

            Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour :
            {
              "summary": "2 ou 3 phrases qui expliquent pourquoi le score est à ce niveau",
              "strengths": ["2 ou 3 points forts du profil pour cette offre"],
              "gaps": ["1 à 3 éléments qui font baisser le score"],
              "actions": [
                {"title": "action courte (5 à 8 mots)", "detail": "une phrase concrète : quoi faire et pourquoi"}
              ]
            }
            Donne exactement 3 actions, de la plus utile à la moins utile.
            """;

    private final AiProvider ai;
    private final AiQuotaService quota;
    private final MatchingService matchingService;
    private final CandidateRepository candidateRepository;
    private final JobOfferRepository jobOfferRepository;
    private final TransactionTemplate tx;

    /** clé « candidat:offre:score:compétences » → explication */
    private final Map<String, CacheEntry> cache = new ConcurrentHashMap<>();

    private record CacheEntry(ScoreExplanation value, Instant at) {}

    record ExplanationJson(String summary, List<String> strengths, List<String> gaps, List<ActionJson> actions) {}

    record ActionJson(String title, String detail) {}

    private record Context(MatchResult match, String sector, Integer years, List<String> skills,
                           String offerTitle, String offerCompany, String offerText) {}

    public ScoreExplanation explain(Long candidateId, Long jobOfferId) {
        Context ctx = loadContext(candidateId, jobOfferId);
        MatchResult m = ctx.match();
        Integer potential = potentialScore(m);

        String key = candidateId + ":" + jobOfferId + ":" + m.score() + ":" + String.join(",", ctx.skills());
        CacheEntry hit = cache.get(key);
        if (hit != null && hit.at().plus(CACHE_TTL).isAfter(Instant.now())) {
            ScoreExplanation v = hit.value();
            return new ScoreExplanation(v.jobOfferId(), v.score(), v.potentialScore(), v.summary(), v.strengths(),
                    v.gaps(), v.actions(), v.aiModel(), true, quota.remaining(candidateId));
        }

        quota.consume(candidateId);
        try {
            AiResponse response = ai.complete(new AiRequest(SYSTEM_PROMPT, userPrompt(ctx), 900, 0.4, true));
            ExplanationJson json = AiJson.parse(response.content(), ExplanationJson.class);
            if (json.summary() == null || json.summary().isBlank()) {
                throw new AiException(AiException.Reason.BAD_RESPONSE, "L'explication reçue est vide. Réessayez.");
            }

            ScoreExplanation result = new ScoreExplanation(
                    jobOfferId, m.score(), potential,
                    json.summary().strip(),
                    clean(json.strengths(), 3),
                    clean(json.gaps(), 3),
                    json.actions() == null ? List.of() : json.actions().stream()
                            .filter(a -> a != null && a.title() != null && !a.title().isBlank())
                            .limit(3)
                            .map(a -> new Action(a.title().strip(), Objects.toString(a.detail(), "").strip()))
                            .toList(),
                    response.model(), false, quota.remaining(candidateId));

            purgeExpired();
            cache.put(key, new CacheEntry(result, Instant.now()));
            log.info("Explication du score générée (candidat {}, offre {}, score {})", candidateId, jobOfferId, m.score());
            return result;

        } catch (RuntimeException e) {
            quota.refund(candidateId);
            throw e;
        }
    }

    /**
     * Score si toutes les technologies de l'offre étaient maîtrisées (expérience et secteur inchangés).
     * Calculé avec les pondérations réelles du secteur : ce n'est pas une estimation de l'IA.
     */
    static Integer potentialScore(MatchResult m) {
        if (m.missingSkills() == null || m.missingSkills().isEmpty() || m.weights() == null) return null;
        MatchingWeights w = m.weights();
        int potential = (int) Math.round(100 * w.skills() + w.experience() * m.experienceScore() + w.sector() * m.sectorScore());
        return potential > m.score() ? Math.min(potential, 100) : null;
    }

    private Context loadContext(Long candidateId, Long jobOfferId) {
        return tx.execute(s -> {
            JobOffer offer = jobOfferRepository.findById(jobOfferId)
                    .orElseThrow(() -> new AiException(AiException.Reason.NOT_FOUND, "Offre introuvable."));
            Candidate c = candidateRepository.findById(candidateId)
                    .orElseThrow(() -> new AiException(AiException.Reason.NOT_FOUND, "Profil introuvable."));
            MatchResult match = matchingService.score(c, offer);
            String offerText = String.join("\n",
                    Objects.toString(offer.getDescription(), ""), Objects.toString(offer.getRequirements(), "")).strip();
            return new Context(match,
                    c.getSector() == null ? null : c.getSector().name(),
                    c.getYearsOfExperience(),
                    c.getSkills() == null ? List.of() : c.getSkills().stream().sorted().toList(),
                    offer.getTitle(), offer.getCompany(), offerText);
        });
    }

    private String userPrompt(Context ctx) {
        MatchResult m = ctx.match();
        MatchingWeights w = m.weights();
        return """
                SCORE GLOBAL (déjà calculé) : %d / 100

                DÉTAIL DU CALCUL (chaque critère noté sur 100, puis pondéré)
                - Compétences : %d / 100 (poids %d %%)
                - Expérience : %d / 100 (poids %d %%)
                - Secteur : %d / 100 (poids %d %%)
                Compétences en commun : %s
                Technologies de l'offre absentes du profil : %s
                Expérience demandée : %s

                CANDIDAT
                Secteur : %s
                Années d'expérience : %s
                Compétences du profil : %s

                OFFRE
                Poste : %s
                Entreprise : %s
                Description :
                %s
                """.formatted(
                m.score(),
                m.skillsScore(), percent(w == null ? 0 : w.skills()),
                m.experienceScore(), percent(w == null ? 0 : w.experience()),
                m.sectorScore(), percent(w == null ? 0 : w.sector()),
                list(m.matchedSkills()),
                list(m.missingSkills()),
                m.requiredYears() == null || m.requiredYears() == 0 ? "non précisée" : m.requiredYears() + " an(s)",
                Objects.toString(ctx.sector(), "Non précisé"),
                ctx.years() == null ? "Non précisé" : ctx.years(),
                list(ctx.skills()),
                Objects.toString(ctx.offerTitle(), "Non précisé"),
                Objects.toString(ctx.offerCompany(), "Non précisée"),
                AiJson.truncate(ctx.offerText(), MAX_OFFER_CHARS));
    }

    private static int percent(double weight) {
        return (int) Math.round(weight * 100);
    }

    private static String list(List<String> values) {
        return values == null || values.isEmpty() ? "aucune" : String.join(", ", values);
    }

    private static List<String> clean(List<String> values, int max) {
        return values == null ? List.of()
                : values.stream().filter(Objects::nonNull).map(String::strip).filter(v -> !v.isEmpty()).limit(max).toList();
    }

    private void purgeExpired() {
        Instant limit = Instant.now().minus(CACHE_TTL);
        cache.values().removeIf(e -> e.at().isBefore(limit));
    }
}
