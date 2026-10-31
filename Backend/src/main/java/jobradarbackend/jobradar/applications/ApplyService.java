package jobradarbackend.jobradar.applications;

import jobradarbackend.jobradar.applications.ApplyDtos.ApplyRequest;
import jobradarbackend.jobradar.applications.ApplyDtos.ApplyResponse;
import jobradarbackend.jobradar.candidate.Candidate;
import jobradarbackend.jobradar.candidate.CandidateRepository;
import jobradarbackend.jobradar.cv.CandidateCv;
import jobradarbackend.jobradar.cv.CandidateCvRepository;
import jobradarbackend.jobradar.documents.CoverLetterDocument;
import jobradarbackend.jobradar.documents.CoverLetterDocumentRepository;
import jobradarbackend.jobradar.joboffer.JobOffer;
import jobradarbackend.jobradar.joboffer.JobOfferRepository;
import jobradarbackend.jobradar.matching.MatchingService;
import jobradarbackend.jobradar.notifications.NotificationService;
import jobradarbackend.jobradar.user.User;
import jobradarbackend.jobradar.user.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.security.Principal;
import java.time.LocalDate;
import java.util.EnumSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

/**
 * Le candidat postule à une offre publiée par un recruteur JobRadar.
 *
 * Si l'offre est déjà dans son Kanban (« à postuler »), la carte passe à APPLIED ;
 * sinon une nouvelle carte est créée directement à APPLIED. C'est ce statut qui la rend
 * visible dans l'espace recruteur. Le recruteur est notifié (cloche + Web Push).
 */
@Service
public class ApplyService {

    private static final Logger log = LoggerFactory.getLogger(ApplyService.class);

    /** Déjà envoyée : on ne postule pas deux fois */
    static final Set<ApplicationStatus> ALREADY_SENT = EnumSet.of(
            ApplicationStatus.APPLIED, ApplicationStatus.INTERVIEW, ApplicationStatus.OFFER,
            ApplicationStatus.HIRED, ApplicationStatus.REJECTED);

    private final UserRepository userRepository;
    private final CandidateRepository candidateRepository;
    private final JobOfferRepository jobOfferRepository;
    private final ApplicationRepository applicationRepository;
    private final CandidateCvRepository candidateCvRepository;
    private final MatchingService matchingService;
    private final CoverLetterDocumentRepository coverLetterRepository;
    private final ApplicationEventService events;
    private final NotificationService notifications;

    /** Injection par constructeur : Spring fournit les 9 dépendances (aucune ne peut rester null) */
    public ApplyService(UserRepository userRepository,
                        CandidateRepository candidateRepository,
                        JobOfferRepository jobOfferRepository,
                        ApplicationRepository applicationRepository,
                        CandidateCvRepository candidateCvRepository,
                        MatchingService matchingService,
                        CoverLetterDocumentRepository coverLetterRepository,
                        ApplicationEventService events,
                        NotificationService notifications) {
        this.userRepository = userRepository;
        this.candidateRepository = candidateRepository;
        this.jobOfferRepository = jobOfferRepository;
        this.applicationRepository = applicationRepository;
        this.candidateCvRepository = candidateCvRepository;
        this.matchingService = matchingService;
        this.coverLetterRepository = coverLetterRepository;
        this.events = events;
        this.notifications = notifications;
    }

    @Transactional
    public ApplyResponse apply(Principal principal, ApplyRequest req) {
        Candidate candidate = currentCandidate(principal);

        JobOffer offer = jobOfferRepository.findById(req.jobOfferId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Offre introuvable."));
        if (offer.getPublisher() == null) {
            // Offre France Travail / Adzuna : la candidature se fait sur le site d'origine
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Cette offre se postule sur le site d'origine.");
        }
        if (!Boolean.TRUE.equals(offer.getIsActive())) {
            throw new ResponseStatusException(HttpStatus.GONE, "Cette offre n'accepte plus de candidatures.");
        }

        // Les deux documents sont obligatoires et doivent appartenir au candidat
        if (req.cvId() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choisissez un CV.");
        }
        if (req.coverLetterId() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choisissez une lettre de motivation.");
        }
        CandidateCv cv = candidateCvRepository.findByIdAndCandidateId(req.cvId(), candidate.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "CV introuvable."));
        CoverLetterDocument letter = coverLetterRepository.findByIdAndCandidateId(req.coverLetterId(), candidate.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Lettre de motivation introuvable."));

        Application application = applicationRepository
                .findByCandidateIdAndJobOfferId(candidate.getId(), offer.getId())
                .orElse(null);
        if (application != null && ALREADY_SENT.contains(application.getStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Vous avez déjà postulé à cette offre.");
        }

        int score = matchingService.score(candidate, offer).score();

        if (application == null) {
            application = Application.builder()
                    .candidate(candidate)
                    .jobOffer(offer)
                    .jobTitle(offer.getTitle())
                    .company(offer.getCompany())
                    .status(ApplicationStatus.TO_APPLY)
                    .build();
        }
        application.setCv(cv);
        application.setCoverLetterDocument(letter);
        application.setMatchScore(score);
        ApplicationStatus from = application.getStatus();
        application.moveTo(ApplicationStatus.APPLIED);
        if (application.getAppliedAt() == null) application.setAppliedAt(LocalDate.now());

        Application saved = applicationRepository.save(application);

        // Historique : première étape de la candidature
        events.record(saved, from, ApplicationStatus.APPLIED, null, candidate.getUser(), "CANDIDATE");

        // Le recruteur est prévenu dans sa cloche (et en Web Push s'il l'a activé)
        if (offer.getPublisher() != null && offer.getPublisher().getOwner() != null) {
            String name = (nullToEmpty(candidate.getFirstName()) + " " + nullToEmpty(candidate.getLastName())).strip();
            notifications.notify(offer.getPublisher().getOwner(), "NEW_APPLICATION",
                    "Nouvelle candidature",
                    (name.isEmpty() ? "Un candidat" : name) + " a postulé à « " + offer.getTitle() + " »"
                            + " (compatibilité " + score + " %).",
                    "/app/recruteur/offres/" + offer.getId() + "/candidats");
        }
        log.info("Candidature {} : candidat {} → offre {}", saved.getId(), candidate.getId(), offer.getId());

        return new ApplyResponse(saved.getId(), offer.getId(), saved.getJobTitle(), saved.getCompany(),
                saved.getStatus(), saved.getMatchScore(), saved.getAppliedAt());
    }

    /**
     * Ids des offres auxquelles le candidat a déjà postulé : le front affiche
     * « Candidature envoyée » au lieu de « Postuler » sur ces offres.
     */
    @Transactional(readOnly = true)
    public List<Long> appliedOfferIds(Principal principal) {
        if (principal == null) return List.of();
        return userRepository.findByEmail(principal.getName())
                .flatMap(user -> candidateRepository.findByUserId(user.getId()))
                .map(candidate -> applicationRepository
                        .findByCandidateIdAndStatusIn(candidate.getId(), ALREADY_SENT).stream()
                        .map(a -> a.getJobOffer() != null ? a.getJobOffer().getId() : null)
                        .filter(Objects::nonNull)
                        .distinct()
                        .toList())
                .orElse(List.of());
    }

    private static String nullToEmpty(String value) {
        return value == null ? "" : value;
    }

    private Candidate currentCandidate(Principal principal) {
        if (principal == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Connexion requise.");
        User user = userRepository.findByEmail(principal.getName())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Utilisateur introuvable."));
        return candidateRepository.findByUserId(user.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT,
                        "Complétez d'abord votre profil candidat."));
    }
}