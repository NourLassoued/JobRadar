package jobradarbackend.jobradar.applications.trancking;
import jobradarbackend.jobradar.applications.trancking.TrackingDtos.*;
import jobradarbackend.jobradar.applications.Application;
import jobradarbackend.jobradar.applications.ApplicationActivity;
import jobradarbackend.jobradar.applications.ApplicationActivityRepository;
import jobradarbackend.jobradar.applications.ApplicationEvent;
import jobradarbackend.jobradar.applications.ApplicationEventRepository;
import jobradarbackend.jobradar.applications.ApplicationEventService;
import jobradarbackend.jobradar.applications.ApplicationNote;
import jobradarbackend.jobradar.applications.ApplicationNoteRepository;
import jobradarbackend.jobradar.applications.ApplicationRepository;
import jobradarbackend.jobradar.applications.ApplicationStatus;
import jobradarbackend.jobradar.applications.NoteType;
import jobradarbackend.jobradar.candidate.Candidate;
import jobradarbackend.jobradar.candidate.CandidateRepository;
import jobradarbackend.jobradar.cv.CandidateCv;
import jobradarbackend.jobradar.documents.CoverLetterDocument;
import jobradarbackend.jobradar.joboffer.JobOffer;
import jobradarbackend.jobradar.joboffer.JobOfferRepository;
import jobradarbackend.jobradar.notifications.NotificationService;
import jobradarbackend.jobradar.recruiter.Company;
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
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;


@Service
public class ApplicationTrackingService {

    private static final Logger log = LoggerFactory.getLogger(ApplicationTrackingService.class);

    /** Colonnes du Kanban, dans l'ordre */
    static final List<ApplicationStatus> BOARD = List.of(
            ApplicationStatus.TO_APPLY, ApplicationStatus.APPLIED, ApplicationStatus.UNDER_REVIEW,
            ApplicationStatus.INTERVIEW, ApplicationStatus.ASSESSMENT, ApplicationStatus.OFFER,
            ApplicationStatus.REJECTED, ApplicationStatus.WITHDRAWN);

    /** Candidature envoyée et encore en cours : le candidat peut la retirer */
    static final Set<ApplicationStatus> IN_PROGRESS = EnumSet.of(
            ApplicationStatus.APPLIED, ApplicationStatus.UNDER_REVIEW, ApplicationStatus.INTERVIEW,
            ApplicationStatus.ASSESSMENT, ApplicationStatus.OFFER);

    /** Étapes qui prouvent un entretien obtenu (statistiques) */
    static final Set<ApplicationStatus> REACHED_INTERVIEW = EnumSet.of(
            ApplicationStatus.INTERVIEW, ApplicationStatus.ASSESSMENT, ApplicationStatus.OFFER, ApplicationStatus.HIRED);

    static final Set<ApplicationStatus> REACHED_OFFER = EnumSet.of(ApplicationStatus.OFFER, ApplicationStatus.HIRED);

    private final UserRepository userRepository;
    private final CandidateRepository candidateRepository;
    private final ApplicationRepository applicationRepository;
    private final JobOfferRepository jobOfferRepository;
    private final ApplicationNoteRepository noteRepository;
    private final ApplicationActivityRepository activityRepository;
    private final ApplicationEventService events;
    private final ApplicationEventRepository eventRepository;
    private final NotificationService notifications;

    public ApplicationTrackingService(UserRepository userRepository,
                                      CandidateRepository candidateRepository,
                                      ApplicationRepository applicationRepository,
                                      JobOfferRepository jobOfferRepository,
                                      ApplicationNoteRepository noteRepository,
                                      ApplicationActivityRepository activityRepository,
                                      ApplicationEventService events,
                                      ApplicationEventRepository eventRepository,
                                      NotificationService notifications) {
        this.userRepository = userRepository;
        this.candidateRepository = candidateRepository;
        this.applicationRepository = applicationRepository;
        this.jobOfferRepository = jobOfferRepository;
        this.noteRepository = noteRepository;
        this.activityRepository = activityRepository;
        this.events = events;
        this.eventRepository = eventRepository;
        this.notifications = notifications;
    }

    // ── Kanban ───────────────────────────────────────────────

    /** Toutes les cartes du candidat, de la plus récente à la plus ancienne */
    @Transactional(readOnly = true)
    public List<TrackingDtos.ApplicationCard> board(Principal principal) {
        Candidate candidate = currentCandidate(principal);
        Map<Long, ApplicationActivity> nextEvents = nextEventsByApplication(candidate.getId());
        return applicationRepository.findByCandidateIdOrderByUpdatedAtDesc(candidate.getId()).stream()
                .sorted(Comparator.comparing(ApplicationTrackingService::sortDate).reversed())
                .map(a -> toCard(a, nextEvents.get(a.getId())))
                .toList();
    }

    /** Déplacement d'une carte (glisser-déposer) : nouveau statut enregistré + historique */
    @Transactional
    public TrackingDtos.ApplicationCard move(Principal principal, Long id, ApplicationStatus target) {
        Candidate candidate = currentCandidate(principal);
        Application a = owned(candidate, id);
        ApplicationStatus from = a.getStatus();
        if (from == target) return toCard(a, nextEvent(a));

        if (!allowedMoves(a).contains(target)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, moveRefusal(a, target));
        }

        a.moveTo(target);
        applicationRepository.save(a);
        events.record(a, from, target, null, candidate.getUser(), "CANDIDATE");

        // Retrait d'une candidature JobRadar : le recruteur est prévenu
        if (target == ApplicationStatus.WITHDRAWN && isManaged(a)) {
            notifyRecruiterOfWithdrawal(a, candidate);
        }
        log.info("Candidature {} : {} → {} (candidat {})", a.getId(), from, target, candidate.getId());
        return toCard(a, nextEvent(a));
    }

    /** Ajoute une offre (ou une candidature externe) au suivi, sans doublon */
    @Transactional
    public ApplicationCard create(Principal principal, CreateRequest req) {
        Candidate candidate = currentCandidate(principal);
        Application a;

        if (req.jobOfferId() != null) {
            JobOffer offer = jobOfferRepository.findById(req.jobOfferId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Offre introuvable."));
            if (applicationRepository.findByCandidateIdAndJobOfferId(candidate.getId(), offer.getId()).isPresent()) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Cette offre est déjà dans votre suivi.");
            }
            a = Application.builder()
                    .candidate(candidate)
                    .jobOffer(offer)
                    .jobTitle(offer.getTitle())
                    .company(companyName(offer))
                    .jobUrl(offer.getUrl())
                    .location(offer.getLocation())
                    .contractType(offer.getContractType() == null ? null : String.valueOf(offer.getContractType()))
                    .status(ApplicationStatus.TO_APPLY)
                    .build();
            // Une offre externe peut être marquée directement comme « Envoyée »
            if (offer.getPublisher() == null && req.status() == ApplicationStatus.APPLIED) {
                a.moveTo(ApplicationStatus.APPLIED);
                if (req.appliedAt() != null) a.setAppliedAt(req.appliedAt());
            }
        } else {
            if (isBlank(req.jobTitle())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Indiquez l'intitulé du poste.");
            }
            String url = blankToNull(req.jobUrl());
            if (url != null && applicationRepository.findByCandidateIdOrderByUpdatedAtDesc(candidate.getId()).stream()
                    .anyMatch(x -> url.equalsIgnoreCase(x.getJobUrl()))) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Une candidature avec ce lien existe déjà dans votre suivi.");
            }
            ApplicationStatus status = req.status() == null ? ApplicationStatus.TO_APPLY : req.status();
            if (!BOARD.contains(status)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Statut non valide.");
            }
            a = Application.builder()
                    .candidate(candidate)
                    .jobTitle(req.jobTitle().strip())
                    .company(blankToNull(req.company()))
                    .jobUrl(url)
                    .location(blankToNull(req.location()))
                    .contractType(blankToNull(req.contractType()))
                    .build();
            a.moveTo(status);
            if (req.appliedAt() != null && status != ApplicationStatus.TO_APPLY) a.setAppliedAt(req.appliedAt());
        }

        Application saved = applicationRepository.save(a);
        events.record(saved, null, saved.getStatus(), null, candidate.getUser(), "CANDIDATE");
        log.info("Candidature {} ajoutée au suivi du candidat {}", saved.getId(), candidate.getId());
        return toCard(saved, null);
    }

    /** Supprime une carte : possible pour une candidature externe, ou une offre JobRadar pas encore envoyée */
    @Transactional
    public void delete(Principal principal, Long id) {
        Application a = owned(currentCandidate(principal), id);
        if (isManaged(a) && a.getStatus() != ApplicationStatus.TO_APPLY) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Cette candidature a été envoyée au recruteur : retirez-la plutôt (colonne « Retirée »).");
        }
        applicationRepository.delete(a);
    }

    // ── Détail ───────────────────────────────────────────────

    @Transactional(readOnly = true)
    public ApplicationDetail detail(Principal principal, Long id) {
        Application a = owned(currentCandidate(principal), id);
        return toDetail(a);
    }

    /** Informations du poste (candidature externe) et contact chez le recruteur */
    @Transactional
    public ApplicationDetail update(Principal principal, Long id, UpdateRequest req) {
        Application a = owned(currentCandidate(principal), id);

        // Intitulé, entreprise, lien, lieu et contrat : modifiables seulement pour une candidature ajoutée à la main
        if (a.getJobOffer() == null) {
            if (req.jobTitle() != null) {
                if (isBlank(req.jobTitle())) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "L'intitulé du poste ne peut pas être vide.");
                }
                a.setJobTitle(req.jobTitle().strip());
            }
            if (req.company() != null) a.setCompany(blankToNull(req.company()));
            if (req.jobUrl() != null) a.setJobUrl(blankToNull(req.jobUrl()));
            if (req.location() != null) a.setLocation(blankToNull(req.location()));
            if (req.contractType() != null) a.setContractType(blankToNull(req.contractType()));
        }
        if (req.appliedAt() != null && a.getStatus() != ApplicationStatus.TO_APPLY && !isManaged(a)) {
            a.setAppliedAt(req.appliedAt());
        }
        if (req.contactName() != null) a.setContactName(blankToNull(req.contactName()));
        if (req.contactRole() != null) a.setContactRole(blankToNull(req.contactRole()));
        if (req.contactEmail() != null) a.setContactEmail(blankToNull(req.contactEmail()));
        if (req.contactPhone() != null) a.setContactPhone(blankToNull(req.contactPhone()));

        return toDetail(applicationRepository.save(a));
    }

    @Transactional
    public ApplicationDetail setFollowUp(Principal principal, Long id, LocalDate followUpAt) {
        Application a = owned(currentCandidate(principal), id);
        a.setNextActionAt(followUpAt);
        return toDetail(applicationRepository.save(a));
    }

    // ── Notes ────────────────────────────────────────────────

    @Transactional
    public NoteItem addNote(Principal principal, Long id, String content) {
        Application a = owned(currentCandidate(principal), id);
        ApplicationNote note = ApplicationNote.builder().content(content.strip()).type(NoteType.NOTE).build();
        a.addNote(note);
        ApplicationNote saved = noteRepository.save(note);
        return toNote(saved);
    }

    @Transactional
    public void deleteNote(Principal principal, Long id, Long noteId) {
        Application a = owned(currentCandidate(principal), id);
        ApplicationNote note = a.getNotes().stream()
                .filter(n -> Objects.equals(n.getId(), noteId))
                .findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Note introuvable."));
        a.removeNote(note);
        noteRepository.delete(note);
    }

    // ── Événements (entretien, appel, test) ──────────────────

    @Transactional
    public ActivityItem addActivity(Principal principal, Long id, ActivityRequest req) {
        Application a = owned(currentCandidate(principal), id);
        ApplicationActivity activity = ApplicationActivity.builder()
                .type(req.type())
                .title(req.title().strip())
                .scheduledAt(req.scheduledAt())
                .location(blankToNull(req.location()))
                .details(blankToNull(req.details()))
                .build();
        a.addActivity(activity);
        return toActivity(activityRepository.save(activity));
    }

    @Transactional
    public ActivityItem setActivityDone(Principal principal, Long id, Long activityId, boolean done) {
        Application a = owned(currentCandidate(principal), id);
        ApplicationActivity activity = activityRepository.findByIdAndApplicationId(activityId, a.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Événement introuvable."));
        activity.setDone(done);
        return toActivity(activityRepository.save(activity));
    }

    @Transactional
    public void deleteActivity(Principal principal, Long id, Long activityId) {
        Application a = owned(currentCandidate(principal), id);
        ApplicationActivity activity = activityRepository.findByIdAndApplicationId(activityId, a.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Événement introuvable."));
        a.removeActivity(activity);
        activityRepository.delete(activity);
    }

    // ── Statistiques ─────────────────────────────────────────

    @Transactional(readOnly = true)
    public Stats stats(Principal principal) {
        Candidate candidate = currentCandidate(principal);
        List<Application> apps = applicationRepository.findByCandidateIdOrderByUpdatedAtDesc(candidate.getId());

        // Étapes atteintes par chaque candidature : historique + statut actuel
        Map<Long, Set<ApplicationStatus>> reached = new HashMap<>();
        for (ApplicationEvent e : eventRepository.findByApplicationCandidateId(candidate.getId())) {
            reached.computeIfAbsent(e.getApplication().getId(), k -> new HashSet<>()).add(e.getToStatus());
        }
        long total = apps.size();
        long sent = 0, interviews = 0, offers = 0, rejected = 0, withdrawn = 0;
        for (Application a : apps) {
            Set<ApplicationStatus> steps = reached.computeIfAbsent(a.getId(), k -> new HashSet<>());
            steps.add(a.getStatus());
            // Envoyée : date d'envoi connue, ou étape après « Enregistrée » (un retrait sans envoi ne compte pas)
            boolean wasSent = a.getAppliedAt() != null
                    || (a.getStatus() != ApplicationStatus.TO_APPLY && a.getStatus() != ApplicationStatus.WITHDRAWN);
            if (wasSent) sent++;
            if (steps.stream().anyMatch(REACHED_INTERVIEW::contains)) interviews++;
            if (steps.stream().anyMatch(REACHED_OFFER::contains)) offers++;
            if (a.getStatus() == ApplicationStatus.REJECTED) rejected++;
            if (a.getStatus() == ApplicationStatus.WITHDRAWN) withdrawn++;
        }
        return new Stats(total, sent, interviews, offers, rejected, withdrawn,
                rate(interviews, sent), rate(offers, interviews));
    }

    // ── Règles ───────────────────────────────────────────────

    /** Colonnes autorisées pour cette carte (le front grise les autres pendant le glisser-déposer) */
    static List<ApplicationStatus> allowedMoves(Application a) {
        ApplicationStatus current = a.getStatus();
        if (isManaged(a)) {
            // Offre d'une entreprise JobRadar : le recruteur décide, le candidat peut seulement retirer
            return IN_PROGRESS.contains(current) ? List.of(ApplicationStatus.WITHDRAWN) : List.of();
        }
        return BOARD.stream().filter(s -> s != current).toList();
    }

    private static String moveRefusal(Application a, ApplicationStatus target) {
        if (!isManaged(a)) return "Déplacement impossible.";
        if (a.getStatus() == ApplicationStatus.TO_APPLY) {
            return "Pour envoyer cette candidature, utilisez le bouton « Postuler » de l'offre (CV et lettre requis).";
        }
        if (target == ApplicationStatus.WITHDRAWN) return "Cette candidature est close : elle ne peut plus être retirée.";
        return "C'est le recruteur qui fait avancer cette candidature. Vous pouvez seulement la retirer.";
    }

    /** Offre publiée par une entreprise sur JobRadar */
    static boolean isManaged(Application a) {
        return a.getJobOffer() != null && a.getJobOffer().getPublisher() != null;
    }

    private void notifyRecruiterOfWithdrawal(Application a, Candidate candidate) {
        Company company = a.getJobOffer().getPublisher();
        if (company.getOwner() == null) return;
        String name = (nullToEmpty(candidate.getFirstName()) + " " + nullToEmpty(candidate.getLastName())).strip();
        notifications.notify(company.getOwner(), "APPLICATION_WITHDRAWN",
                "Candidature retirée",
                (name.isEmpty() ? "Un candidat" : name) + " a retiré sa candidature à « " + a.getJobOffer().getTitle() + " ».",
                "/app/recruteur/offres/" + a.getJobOffer().getId() + "/candidats");
    }

    // ── Conversion en DTO ────────────────────────────────────

    private ApplicationCard toCard(Application a, ApplicationActivity next) {
        JobOffer offer = a.getJobOffer();
        Company publisher = offer != null ? offer.getPublisher() : null;
        String location = a.getLocation() != null ? a.getLocation() : offer != null ? offer.getLocation() : null;
        String contract = a.getContractType() != null ? a.getContractType()
                : offer != null && offer.getContractType() != null ? String.valueOf(offer.getContractType()) : null;
        String url = a.getJobUrl() != null ? a.getJobUrl() : offer != null ? offer.getUrl() : null;

        return new ApplicationCard(
                a.getId(),
                offer != null ? offer.getId() : null,
                a.getJobTitle(),
                publisher != null ? publisher.getName() : a.getCompany(),
                publisher != null ? publisher.getLogoUrl() : null,
                location,
                contract,
                a.getStatus(),
                a.getAppliedAt(),
                a.getCreatedAt(),
                a.getUpdatedAt(),
                next != null ? next.getScheduledAt() : null,
                next != null ? next.getType() : null,
                a.getNextActionAt(),
                url,
                a.getMatchScore(),
                isManaged(a),
                allowedMoves(a));
    }

    private ApplicationDetail toDetail(Application a) {
        JobOffer offer = a.getJobOffer();
        OfferInfo offerInfo = offer == null ? null : new OfferInfo(
                offer.getDescription(),
                offer.getRequirements(),
                offer.getSalaryMin(),
                offer.getSalaryMax(),
                offer.getRemote(),
                offer.getSector() == null ? null : String.valueOf(offer.getSector()),
                offer.getSource() == null ? null : String.valueOf(offer.getSource()),
                Boolean.TRUE.equals(offer.getIsActive()),
                offer.getCreatedAt());

        CandidateCv cv = a.getCv();
        CoverLetterDocument letter = a.getCoverLetterDocument();
        Documents documents = new Documents(
                cv != null ? firstNonBlank(cv.getTitle(), cv.getFileName()) : null,
                cv != null ? cv.getFileUrl() : null,
                letter != null ? firstNonBlank(letter.getTitle(), letter.getFileName()) : null,
                letter != null ? letter.getFileUrl() : null,
                blankToNull(a.getCoverLetter()));

        Contact contact = new Contact(a.getContactName(), a.getContactRole(), a.getContactEmail(), a.getContactPhone());

        List<NoteItem> notes = noteRepository.findByApplicationIdOrderByCreatedAtDesc(a.getId()).stream()
                .map(ApplicationTrackingService::toNote).toList();
        List<ApplicationActivity> activityList = activityRepository.findByApplicationIdOrderByScheduledAtAsc(a.getId());
        List<ActivityItem> activities = activityList.stream().map(ApplicationTrackingService::toActivity).toList();
        List<HistoryItem> history = events.history(a.getId()).stream()
                .map(e -> new HistoryItem(e.getId(), e.getFromStatus(), e.getToStatus(), e.getMessage(),
                        e.getActorRole(), e.getCreatedAt()))
                .toList();

        ApplicationActivity next = activityList.stream()
                .filter(x -> !x.isDone() && x.getScheduledAt().isAfter(LocalDateTime.now()))
                .findFirst().orElse(null);

        return new ApplicationDetail(toCard(a, next), offerInfo, documents, contact, notes, activities, history);
    }

    private static NoteItem toNote(ApplicationNote n) {
        return new NoteItem(n.getId(), n.getContent(), n.getCreatedAt());
    }

    private static ActivityItem toActivity(ApplicationActivity x) {
        return new ActivityItem(x.getId(), x.getType(), x.getTitle(), x.getScheduledAt(), x.getLocation(),
                x.getDetails(), x.isDone());
    }

    // ── Outils ───────────────────────────────────────────────

    /** Prochain événement à venir de chaque candidature (une seule requête pour tout le Kanban) */
    private Map<Long, ApplicationActivity> nextEventsByApplication(Long candidateId) {
        Map<Long, ApplicationActivity> next = new HashMap<>();
        for (ApplicationActivity x : activityRepository
                .findByApplicationCandidateIdAndDoneFalseAndScheduledAtAfterOrderByScheduledAtAsc(candidateId, LocalDateTime.now())) {
            next.putIfAbsent(x.getApplication().getId(), x);
        }
        return next;
    }

    private ApplicationActivity nextEvent(Application a) {
        return activityRepository.findByApplicationIdOrderByScheduledAtAsc(a.getId()).stream()
                .filter(x -> !x.isDone() && x.getScheduledAt().isAfter(LocalDateTime.now()))
                .findFirst().orElse(null);
    }

    /** Ordre chronologique : date d'envoi, sinon date d'ajout au suivi */
    private static LocalDateTime sortDate(Application a) {
        if (a.getAppliedAt() != null) return a.getAppliedAt().atStartOfDay();
        return a.getCreatedAt() != null ? a.getCreatedAt() : LocalDateTime.MIN;
    }

    private Application owned(Candidate candidate, Long id) {
        return applicationRepository.findByIdAndCandidateId(id, candidate.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Candidature introuvable."));
    }

    private Candidate currentCandidate(Principal principal) {
        if (principal == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Connexion requise.");
        User user = userRepository.findByEmail(principal.getName())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Utilisateur introuvable."));
        return candidateRepository.findByUserId(user.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT,
                        "Complétez d'abord votre profil candidat."));
    }

    private static String companyName(JobOffer offer) {
        return offer.getPublisher() != null ? offer.getPublisher().getName() : offer.getCompany();
    }

    private static Double rate(long part, long whole) {
        if (whole == 0) return null;
        return Math.round(part * 1000.0 / whole) / 10.0;
    }

    private static boolean isBlank(String v) {
        return v == null || v.isBlank();
    }

    private static String blankToNull(String v) {
        return isBlank(v) ? null : v.strip();
    }

    private static String firstNonBlank(String a, String b) {
        return !isBlank(a) ? a : b;
    }

    private static String nullToEmpty(String v) {
        return v == null ? "" : v;
    }
}
