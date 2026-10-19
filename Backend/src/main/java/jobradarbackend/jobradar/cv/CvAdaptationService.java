package jobradarbackend.jobradar.cv;

import jobradarbackend.jobradar.ai.*;
import jobradarbackend.jobradar.candidate.Candidate;
import jobradarbackend.jobradar.candidate.CandidateRepository;
import jobradarbackend.jobradar.cv.*;
import jobradarbackend.jobradar.joboffer.JobOffer;
import jobradarbackend.jobradar.joboffer.JobOfferRepository;
import jobradarbackend.jobradar.matching.OfferTextAnalyzer;
import jobradarbackend.jobradar.matching.recommendation.SkillDictionary;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.*;

/**
 * Adapte un CV à une offre avec l'IA :
 *  1. texte du CV (extrait du PDF si besoin) + texte de l'offre ;
 *  2. score AVANT = part des technologies de l'offre présentes dans le CV ;
 *  3. appel à l'IA avec des règles anti-invention, réponse JSON ;
 *  4. score APRÈS sur le CV adapté + liste des technologies ajoutées sans preuve (garde-fou) ;
 *  5. enregistrement en brouillon (DRAFT) dans cv_adaptations.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CvAdaptationService {

    private static final int MAX_OFFER_CHARS = 6_000;
    private static final int MAX_CV_CHARS = 8_000;
    private static final int MIN_OFFER_SKILLS = 3;
    private static final int OFFER_SKILLS_FOR_FULL_SCORE = 10;

    static final String SYSTEM_PROMPT = """
            Tu es un expert du recrutement en France. Tu adaptes un CV à une offre d'emploi précise.

            RÈGLES STRICTES :
            1. N'invente RIEN : aucune expérience, entreprise, diplôme, date, chiffre, projet ou compétence
               qui n'est pas déjà dans le CV d'origine.
            2. Tu peux : réorganiser les sections, reformuler, mettre en avant les expériences et compétences
               utiles pour l'offre, reprendre le vocabulaire exact de l'offre quand il décrit une compétence
               DÉJÀ présente dans le CV, écrire un titre et un court résumé de profil ciblés.
            3. Une compétence demandée par l'offre mais absente du CV va UNIQUEMENT dans "suggestions",
               jamais dans le CV adapté.
            4. Garde la langue du CV d'origine. Garde les coordonnées telles quelles.
            5. Format du CV adapté : Markdown simple (## pour les sections, - pour les listes).

            Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour, de la forme :
            {
              "adaptedCv": "le CV adapté en Markdown",
              "keywordsAdded": ["mots-clés de l'offre mis en avant, déjà présents dans le CV"],
              "suggestions": ["conseils concrets pour améliorer la candidature, 3 à 6 éléments"]
            }
            """;

    private final AiProvider ai;
    private final AiQuotaService quota;
    private final CvService cvService;
    private final CvAdaptationRepository adaptationRepository;
    private final CandidateCvRepository cvRepository;
    private final CandidateRepository candidateRepository;
    private final JobOfferRepository jobOfferRepository;
    private final TransactionTemplate tx;

    /** Réponse JSON attendue de l'IA */
    record AdaptationJson(String adaptedCv, List<String> keywordsAdded, List<String> suggestions) {}

    /** Données lues en base, copiées pour travailler hors transaction */
    private record Context(String offerTitle, String offerCompany, String offerText, String offerNormalized,
                           Set<String> candidateSkills) {}

    public AiDtos.CvAdaptationResponse adapt(Long candidateId, Long jobOfferId, Long requestedCvId) {
        quota.consume(candidateId);
        try {
            Long cvId = cvService.resolveCvId(candidateId, requestedCvId);
            String cvText = cvService.ensureText(candidateId, cvId);
            Context ctx = loadContext(candidateId, jobOfferId);

            // Score AVANT
            List<String> offerSkills = SkillDictionary.detect(ctx.offerNormalized());
            Integer scoreBefore = coverage(offerSkills, cvText);

            // Appel à l'IA
            AiResponse response = ai.complete(new AiRequest(SYSTEM_PROMPT, userPrompt(ctx, cvText), 3_000, 0.3, true));
            AdaptationJson json = AiJson.parse(response.content(), AdaptationJson.class);
            if (json.adaptedCv() == null || json.adaptedCv().strip().length() < 200) {
                throw new AiException(AiException.Reason.BAD_RESPONSE, "Le CV adapté reçu est incomplet. Réessayez.");
            }

            // Score APRÈS + garde-fou anti-invention
            Integer scoreAfter = coverage(offerSkills, json.adaptedCv());
            List<String> unverified = unverifiedSkills(cvText, json.adaptedCv(), ctx.candidateSkills());

            List<String> suggestions = new ArrayList<>(clean(json.suggestions()));
            if (!unverified.isEmpty()) {
                suggestions.add(0, "À vérifier : " + String.join(", ", unverified)
                        + " apparaît dans le CV adapté mais pas dans votre CV d'origine. Retirez-le si vous ne le maîtrisez pas.");
            }

            CvAdaptation saved = tx.execute(s -> adaptationRepository.save(CvAdaptation.builder()
                    .cv(cvRepository.getReferenceById(cvId))
                    .jobOffer(jobOfferRepository.getReferenceById(jobOfferId))
                    .adaptedContent(json.adaptedCv().strip())
                    .keywordsAdded(clean(json.keywordsAdded()))
                    .suggestions(suggestions)
                    .scoreBefore(scoreBefore)
                    .scoreAfter(scoreAfter)
                    .aiModel(response.model())
                    .status(CvAdaptationStatus.DRAFT)
                    .build()));

            log.info("CV {} adapté pour l'offre {} : couverture {} → {} ({} à vérifier)",
                    cvId, jobOfferId, scoreBefore, scoreAfter, unverified.size());

            return toResponse(saved.getId(), candidateId, unverified);

        } catch (RuntimeException e) {
            quota.refund(candidateId);   // échec : la génération n'est pas décomptée
            throw e;
        }
    }

    @Transactional(readOnly = true)
    public List<AiDtos.CvAdaptationResponse> listForOffer(Long candidateId, Long jobOfferId) {
        return adaptationRepository.findByCvCandidateIdAndJobOfferIdOrderByCreatedAtDesc(candidateId, jobOfferId).stream()
                .map(a -> AiDtos.CvAdaptationResponse.from(a, List.of(), null))
                .toList();
    }

    @Transactional
    public AiDtos.CvAdaptationResponse updateStatus(Long candidateId, Long adaptationId, CvAdaptationStatus status) {
        CvAdaptation a = adaptationRepository.findByIdAndCvCandidateId(adaptationId, candidateId)
                .orElseThrow(() -> new AiException(AiException.Reason.NOT_FOUND, "Adaptation introuvable."));
        a.setStatus(status);
        return AiDtos.CvAdaptationResponse.from(a, List.of(), null);
    }

    // ── Étapes ───────────────────────────────────────────────

    private Context loadContext(Long candidateId, Long jobOfferId) {
        return tx.execute(s -> {
            JobOffer offer = jobOfferRepository.findById(jobOfferId)
                    .orElseThrow(() -> new AiException(AiException.Reason.NOT_FOUND, "Offre introuvable."));
            Candidate candidate = candidateRepository.findById(candidateId)
                    .orElseThrow(() -> new AiException(AiException.Reason.NOT_FOUND, "Profil introuvable."));

            Set<String> skills = new HashSet<>();
            if (candidate.getSkills() != null) {
                for (String skill : candidate.getSkills()) {
                    if (skill != null) skills.add(SkillDictionary.canonical(skill).orElse(skill.trim()));
                }
            }
            String offerText = String.join("\n",
                    Objects.toString(offer.getDescription(), ""),
                    Objects.toString(offer.getRequirements(), "")).strip();
            return new Context(offer.getTitle(), offer.getCompany(), offerText, OfferTextAnalyzer.offerText(offer), skills);
        });
    }

    private String userPrompt(Context ctx, String cvText) {
        return """
                OFFRE D'EMPLOI
                Poste : %s
                Entreprise : %s
                Description :
                %s

                CV D'ORIGINE
                %s
                """.formatted(
                Objects.toString(ctx.offerTitle(), "Non précisé"),
                Objects.toString(ctx.offerCompany(), "Non précisée"),
                AiJson.truncate(ctx.offerText(), MAX_OFFER_CHARS),
                AiJson.truncate(cvText, MAX_CV_CHARS));
    }

    /** Part des technologies de l'offre présentes dans un texte (même règle que le matching, sur 10 max) */
    static Integer coverage(List<String> offerSkills, String text) {
        if (offerSkills.size() < MIN_OFFER_SKILLS) return null;
        String normalized = OfferTextAnalyzer.normalize(text);
        long covered = offerSkills.stream().filter(s -> SkillDictionary.mentions(normalized, s)).count();
        return (int) Math.round(Math.min(1.0, (double) covered / Math.min(offerSkills.size(), OFFER_SKILLS_FOR_FULL_SCORE)) * 100);
    }

    /** Technologies du CV adapté absentes du CV d'origine ET du profil : ajout possiblement inventé */
    static List<String> unverifiedSkills(String originalCv, String adaptedCv, Set<String> profileSkills) {
        Set<String> before = new HashSet<>(SkillDictionary.detect(OfferTextAnalyzer.normalize(originalCv)));
        return SkillDictionary.detect(OfferTextAnalyzer.normalize(adaptedCv)).stream()
                .filter(s -> !before.contains(s) && !profileSkills.contains(s))
                .toList();
    }

    private static List<String> clean(List<String> values) {
        if (values == null) return List.of();
        return values.stream().filter(Objects::nonNull).map(String::strip).filter(v -> !v.isEmpty()).distinct().limit(12).toList();
    }

    private AiDtos.CvAdaptationResponse toResponse(Long adaptationId, Long candidateId, List<String> unverified) {
        return tx.execute(s -> {
            CvAdaptation a = adaptationRepository.findById(adaptationId).orElseThrow();
            return AiDtos.CvAdaptationResponse.from(a, unverified, quota.remaining(candidateId));
        });
    }
}