package jobradarbackend.jobradar.ai.interview;

import jobradarbackend.jobradar.ai.AiDtos;
import jobradarbackend.jobradar.ai.AiException;
import jobradarbackend.jobradar.ai.AiJson;
import jobradarbackend.jobradar.ai.AiProvider;
import jobradarbackend.jobradar.ai.AiQuotaService;
import jobradarbackend.jobradar.ai.AiRequest;
import jobradarbackend.jobradar.ai.AiResponse;
import jobradarbackend.jobradar.ai.interview.InterviewDtos.InterviewPrepRequest;
import jobradarbackend.jobradar.ai.interview.InterviewDtos.InterviewPrepResponse;
import jobradarbackend.jobradar.ai.interview.InterviewDtos.InterviewQuestion;
import jobradarbackend.jobradar.ai.interview.InterviewQuestionSanitizer.RawQuestion;
import jobradarbackend.jobradar.candidate.Candidate;
import jobradarbackend.jobradar.candidate.CandidateRepository;
import jobradarbackend.jobradar.cv.CandidateCvRepository;
import jobradarbackend.jobradar.cv.CvService;
import jobradarbackend.jobradar.joboffer.JobOffer;
import jobradarbackend.jobradar.joboffer.JobOfferRepository;
import jobradarbackend.jobradar.matching.MatchResult;
import jobradarbackend.jobradar.matching.MatchingService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.List;
import java.util.Objects;

/**
 * Préparation aux entretiens : questions probables pour une offre, avec une piste de réponse
 * construite à partir du parcours réel du candidat.
 *
 * Le matching (compétences communes / manquantes) est calculé AVANT l'appel à l'IA et lui est transmis :
 *  - compétences communes  → questions techniques et d'expérience ;
 *  - compétences manquantes → questions « GAP », avec une réponse honnête (jamais « je maîtrise »).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class InterviewPrepService {

    private static final int MAX_OFFER_CHARS = 5_000;
    private static final int MAX_CV_CHARS = 6_000;
    private static final int DEFAULT_QUESTIONS = 8;
    private static final int MIN_QUESTIONS = 3;
    private static final int MAX_MISSING_IN_PROMPT = 8;

    static final String SYSTEM_PROMPT = """
            Tu es un recruteur expérimenté qui prépare un candidat à un entretien d'embauche pour une offre précise.

            OBJECTIF : prédire les questions que le recruteur posera le plus probablement, et proposer pour chacune
            une piste de réponse fondée sur le parcours RÉEL du candidat.

            RÈGLES STRICTES :
            1. Les questions viennent de l'offre : missions, technologies, contexte, niveau d'expérience demandé.
            2. Les réponses n'utilisent QUE les expériences, projets, compétences et diplômes présents dans le profil
               ou le CV fournis. N'invente aucune entreprise, aucun projet, aucun chiffre, aucune durée.
            3. Pour une compétence de la liste « COMPÉTENCES MANQUANTES », la question est de catégorie GAP et la réponse
               est HONNÊTE : le candidat reconnaît ne pas l'avoir pratiquée, s'appuie sur une compétence proche qu'il possède
               réellement et explique comment il compte la maîtriser. Ne prétends jamais qu'il la maîtrise.
            4. Répartis les questions : au moins une MOTIVATION, une EXPERIENCE, une BEHAVIORAL (réponse au format STAR :
               Situation, Tâche, Action, Résultat), plusieurs TECHNICAL, et une ou deux GAP s'il y a des compétences manquantes.
            5. Réponses courtes et naturelles, à la première personne, 60 à 120 mots chacune.
            6. N'ajoute ni ville, ni disponibilité, ni mobilité qui ne figurent pas dans le profil ou le CV.

            Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour, de la forme :
            {
              "questions": [
                {
                  "category": "TECHNICAL | EXPERIENCE | BEHAVIORAL | MOTIVATION | GAP",
                  "question": "la question du recruteur",
                  "why": "pourquoi cette question est probable, en une phrase liée à l'offre",
                  "suggestedAnswer": "piste de réponse à la première personne",
                  "keyPoints": ["2 à 4 points clés à mentionner"],
                  "relatedSkill": "compétence de l'offre concernée, ou null"
                }
              ],
              "questionsToAsk": ["3 questions pertinentes que le candidat peut poser au recruteur"],
              "tips": ["3 conseils de préparation propres à cette offre"]
            }
            """;

    private final AiProvider ai;
    private final AiQuotaService quota;
    private final CvService cvService;
    private final CandidateCvRepository cvRepository;
    private final CandidateRepository candidateRepository;
    private final JobOfferRepository jobOfferRepository;
    private final MatchingService matchingService;
    private final TransactionTemplate tx;

    /** Réponse brute de l'IA */
    record PrepJson(List<RawQuestion> questions, List<String> questionsToAsk, List<String> tips) {}

    private record Context(String fullName, String sector, Integer years, List<String> skills,
                           Long offerId, String offerTitle, String offerCompany, String offerText,
                           MatchResult match) {}

    public InterviewPrepResponse generate(Long candidateId, InterviewPrepRequest req) {
        int count = req.questionCount() == null ? DEFAULT_QUESTIONS : req.questionCount();

        quota.consume(candidateId);
        try {
            // 1. Données en base (transaction courte) ; l'appel à l'IA se fait en dehors
            Context ctx = loadContext(candidateId, req.jobOfferId());
            String cvText = optionalCvText(candidateId, req.cvId());

            // 2. Appel à l'IA
            AiResponse response = ai.complete(new AiRequest(
                    SYSTEM_PROMPT, userPrompt(ctx, cvText, req.language(), count), 4_000, 0.5, true));
            PrepJson json = AiJson.parse(response.content(), PrepJson.class);

            // 3. Nettoyage et garde-fous
            List<InterviewQuestion> questions = InterviewQuestionSanitizer.sanitize(
                    json.questions(), count, ctx.match().missingSkills());
            if (questions.size() < MIN_QUESTIONS) {
                throw new AiException(AiException.Reason.BAD_RESPONSE,
                        "La préparation reçue est incomplète. Réessayez.");
            }

            log.info("Préparation d'entretien générée pour l'offre {} ({} questions)", ctx.offerId(), questions.size());
            return new InterviewPrepResponse(
                    ctx.offerId(),
                    ctx.offerTitle(),
                    ctx.offerCompany(),
                    ctx.match().score(),
                    nullToEmpty(ctx.match().matchedSkills()),
                    nullToEmpty(ctx.match().missingSkills()),
                    questions,
                    InterviewQuestionSanitizer.cleanList(json.questionsToAsk(), 4),
                    InterviewQuestionSanitizer.cleanList(json.tips(), 4),
                    response.model(),
                    quota.remaining(candidateId));

        } catch (RuntimeException e) {
            quota.refund(candidateId); // échec : la génération n'est pas décomptée
            throw e;
        }
    }

    private Context loadContext(Long candidateId, Long jobOfferId) {
        return tx.execute(s -> {
            JobOffer offer = jobOfferRepository.findById(jobOfferId)
                    .orElseThrow(() -> new AiException(AiException.Reason.NOT_FOUND, "Offre introuvable."));
            Candidate c = candidateRepository.findById(candidateId)
                    .orElseThrow(() -> new AiException(AiException.Reason.NOT_FOUND, "Profil introuvable."));

            String name = (Objects.toString(c.getFirstName(), "") + " " + Objects.toString(c.getLastName(), "")).strip();
            String offerText = String.join("\n",
                    Objects.toString(offer.getDescription(), ""), Objects.toString(offer.getRequirements(), "")).strip();

            return new Context(name,
                    c.getSector() == null ? null : c.getSector().name(),
                    c.getYearsOfExperience(),
                    c.getSkills() == null ? List.of() : List.copyOf(c.getSkills()),
                    offer.getId(), offer.getTitle(), offer.getCompany(), offerText,
                    matchingService.score(c, offer));
        });
    }

    /** Le CV enrichit les réponses, mais il n'est pas obligatoire : sans CV, on utilise le profil seul */
    private String optionalCvText(Long candidateId, Long cvId) {
        try {
            Long id = cvId != null ? cvId
                    : cvRepository.findFirstByCandidateIdAndDefaultCvTrue(candidateId).map(cv -> cv.getId()).orElse(null);
            return id == null ? "" : cvService.ensureText(candidateId, id);
        } catch (AiException e) {
            log.info("Préparation d'entretien sans CV : {}", e.getMessage());
            return "";
        }
    }

    private String userPrompt(Context ctx, String cvText, AiDtos.Language language, int count) {
        MatchResult m = ctx.match();
        List<String> missing = nullToEmpty(m.missingSkills()).stream().limit(MAX_MISSING_IN_PROMPT).toList();

        return """
                CONSIGNES : exactement %d questions, rédigées en %s.

                CANDIDAT
                Nom : %s
                Secteur : %s
                Années d'expérience : %s
                Compétences du profil : %s

                CV (peut être vide)
                %s

                ANALYSE DE COMPATIBILITÉ (calculée par JobRadar)
                Score global : %d / 100
                Compétences communes avec l'offre : %s
                COMPÉTENCES MANQUANTES (demandées par l'offre, absentes du profil) : %s

                OFFRE D'EMPLOI
                Poste : %s
                Entreprise : %s
                Description :
                %s
                """.formatted(
                count,
                language == AiDtos.Language.EN ? "anglais" : "français",
                ctx.fullName().isBlank() ? "Non précisé" : ctx.fullName(),
                Objects.toString(ctx.sector(), "Non précisé"),
                ctx.years() == null ? "Non précisé" : ctx.years(),
                ctx.skills().isEmpty() ? "Non précisées" : String.join(", ", ctx.skills()),
                AiJson.truncate(cvText, MAX_CV_CHARS),
                m.score(),
                listOrNone(m.matchedSkills()),
                missing.isEmpty() ? "Aucune" : String.join(", ", missing),
                Objects.toString(ctx.offerTitle(), "Non précisé"),
                Objects.toString(ctx.offerCompany(), "Non précisée"),
                AiJson.truncate(ctx.offerText(), MAX_OFFER_CHARS));
    }

    private static List<String> nullToEmpty(List<String> list) {
        return list == null ? List.of() : list;
    }

    private static String listOrNone(List<String> list) {
        return list == null || list.isEmpty() ? "Aucune" : String.join(", ", list);
    }
}