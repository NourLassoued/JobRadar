package jobradarbackend.jobradar.ai.letter;

import jobradarbackend.jobradar.ai.*;
import jobradarbackend.jobradar.candidate.Candidate;
import jobradarbackend.jobradar.candidate.CandidateRepository;
import jobradarbackend.jobradar.cv.CandidateCvRepository;
import jobradarbackend.jobradar.cv.CvService;
import jobradarbackend.jobradar.joboffer.JobOffer;
import jobradarbackend.jobradar.joboffer.JobOfferRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.List;
import java.util.Objects;

/**
 * Rédige une lettre de motivation pour une offre, à partir du profil et du CV (s'il existe).
 * Même fournisseur d'IA que l'adaptation de CV ; seule la consigne change.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CoverLetterService {

    private static final int MAX_OFFER_CHARS = 5_000;
    private static final int MAX_CV_CHARS = 6_000;

    static final String SYSTEM_PROMPT = """
            Tu es un expert du recrutement. Tu rédiges une lettre de motivation pour une offre précise.

            RÈGLES STRICTES :
            1. N'invente RIEN : n'utilise que les expériences, compétences, diplômes et réalisations
               présents dans le profil ou le CV fournis. Aucun chiffre inventé.
            2. Relie concrètement 2 ou 3 éléments du parcours aux besoins de l'offre.
            3. Structure : accroche personnalisée, adéquation profil/poste, motivation pour l'entreprise,
               conclusion avec demande d'entretien. Pas d'adresse ni de date en en-tête.
            4. Aucun texte entre crochets à compléter. Si le nom de l'entreprise est inconnu, écris « votre entreprise ».
            5. Signe avec le prénom et le nom du candidat.

            Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour, de la forme :
            {
              "subject": "objet de l'e-mail de candidature",
              "letter": "la lettre complète, paragraphes séparés par une ligne vide",
              "highlights": ["2 à 4 points forts du candidat mis en avant dans la lettre"]
            }
            """;

    private final AiProvider ai;
    private final AiQuotaService quota;
    private final CvService cvService;
    private final CandidateCvRepository cvRepository;
    private final CandidateRepository candidateRepository;
    private final JobOfferRepository jobOfferRepository;
    private final TransactionTemplate tx;

    record LetterJson(String subject, String letter, List<String> highlights) {}

    private record Context(String fullName, String sector, Integer years, List<String> skills,
                           String offerTitle, String offerCompany, String offerText) {}

    public AiDtos.CoverLetterResponse generate(Long candidateId, AiDtos.CoverLetterRequest req) {
        quota.consume(candidateId);
        try {
            Context ctx = loadContext(candidateId, req.jobOfferId());
            String cvText = optionalCvText(candidateId, req.cvId());

            AiResponse response = ai.complete(new AiRequest(
                    SYSTEM_PROMPT, userPrompt(ctx, cvText, req), 1_500, 0.7, true));
            LetterJson json = AiJson.parse(response.content(), LetterJson.class);
            if (json.letter() == null || json.letter().strip().length() < 300) {
                throw new AiException(AiException.Reason.BAD_RESPONSE, "La lettre reçue est incomplète. Réessayez.");
            }

            log.info("Lettre générée pour l'offre {} ({} caractères)", req.jobOfferId(), json.letter().length());
            return new AiDtos.CoverLetterResponse(
                    Objects.toString(json.subject(), "Candidature : " + ctx.offerTitle()).strip(),
                    json.letter().strip(),
                    json.highlights() == null ? List.of()
                            : json.highlights().stream().filter(Objects::nonNull).map(String::strip).limit(4).toList(),
                    response.model(),
                    quota.remaining(candidateId));

        } catch (RuntimeException e) {
            quota.refund(candidateId);
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
            return new Context(name, c.getSector() == null ? null : c.getSector().name(), c.getYearsOfExperience(),
                    c.getSkills() == null ? List.of() : List.copyOf(c.getSkills()),
                    offer.getTitle(), offer.getCompany(), offerText);
        });
    }

    /** Le CV enrichit la lettre, mais il n'est pas obligatoire : sans CV, on utilise le profil seul */
    private String optionalCvText(Long candidateId, Long cvId) {
        try {
            Long id = cvId != null ? cvId
                    : cvRepository.findFirstByCandidateIdAndDefaultCvTrue(candidateId).map(cv -> cv.getId()).orElse(null);
            return id == null ? "" : cvService.ensureText(candidateId, id);
        } catch (AiException e) {
            log.info("Lettre sans CV : {}", e.getMessage());
            return "";
        }
    }

    private String userPrompt(Context ctx, String cvText, AiDtos.CoverLetterRequest req) {
        String tone = req.tone() == AiDtos.Tone.DYNAMIC
                ? "dynamique et chaleureux, tout en restant professionnel"
                : "formel et professionnel";
        String length = req.length() == AiDtos.Length.SHORT ? "environ 150 mots" : "environ 250 à 300 mots";
        String language = req.language() == AiDtos.Language.EN ? "anglais" : "français";

        return """
                CONSIGNES : ton %s, %s, rédigée en %s.

                CANDIDAT
                Nom : %s
                Secteur : %s
                Années d'expérience : %s
                Compétences : %s

                CV (peut être vide)
                %s

                OFFRE D'EMPLOI
                Poste : %s
                Entreprise : %s
                Description :
                %s
                """.formatted(tone, length, language,
                ctx.fullName().isBlank() ? "Non précisé" : ctx.fullName(),
                Objects.toString(ctx.sector(), "Non précisé"),
                ctx.years() == null ? "Non précisé" : ctx.years(),
                ctx.skills().isEmpty() ? "Non précisées" : String.join(", ", ctx.skills()),
                AiJson.truncate(cvText, MAX_CV_CHARS),
                Objects.toString(ctx.offerTitle(), "Non précisé"),
                Objects.toString(ctx.offerCompany(), "Non précisée"),
                AiJson.truncate(ctx.offerText(), MAX_OFFER_CHARS));
    }
}