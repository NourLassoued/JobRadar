package jobradarbackend.jobradar.interviews;

import jobradarbackend.jobradar.applications.ActivityType;
import jobradarbackend.jobradar.applications.Application;
import jobradarbackend.jobradar.applications.ApplicationActivity;
import jobradarbackend.jobradar.applications.ApplicationActivityRepository;
import jobradarbackend.jobradar.applications.ApplicationRepository;
import jobradarbackend.jobradar.applications.ApplicationStatus;
import jobradarbackend.jobradar.candidate.Candidate;
import jobradarbackend.jobradar.candidate.CandidateRepository;
import jobradarbackend.jobradar.interviews.InterviewSlot.Author;
import jobradarbackend.jobradar.interviews.InterviewSlot.Mode;
import jobradarbackend.jobradar.interviews.InterviewSlot.Status;
import jobradarbackend.jobradar.interviews.InterviewSlotDtos.*;
import jobradarbackend.jobradar.Mail.*;
import jobradarbackend.jobradar.Mail.HtmlMailer;
import jobradarbackend.jobradar.notifications.NotificationService;
import jobradarbackend.jobradar.recruiter.Company;
import jobradarbackend.jobradar.recruiter.CompanyRepository;
import jobradarbackend.jobradar.recruiter.RecruiterDtos.ApplicantResponse;
import jobradarbackend.jobradar.recruiter.RecruiterService;
import jobradarbackend.jobradar.user.User;
import jobradarbackend.jobradar.user.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.security.Principal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;

/**
 * Prise de rendez-vous pour l'entretien.
 *
 *  1. Le recruteur propose 1 à 3 créneaux (la candidature passe à « Entretien » si besoin).
 *  2. Le candidat en choisit un… ou propose un autre moment.
 *  3. Si le candidat a proposé un moment, le recruteur l'accepte ou propose d'autres créneaux.
 *  4. Le créneau accepté devient un événement « Entretien » dans le suivi du candidat,
 *     et l'autre partie est prévenue (cloche + e-mail).
 *
 * Sécurité : le recruteur n'agit que sur les candidatures envoyées aux offres de SON entreprise,
 * le candidat que sur SES candidatures ; sinon 404.
 */
@Service
public class InterviewSlotService {

    private static final Logger log = LoggerFactory.getLogger(InterviewSlotService.class);

    private static final DateTimeFormatter DAY_TIME =
            DateTimeFormatter.ofPattern("EEEE d MMMM 'à' HH'h'mm", Locale.FRENCH);
    private static final DateTimeFormatter TIME = DateTimeFormatter.ofPattern("HH'h'mm", Locale.FRENCH);

    private static final Set<Status> OPEN = EnumSet.of(Status.PROPOSED, Status.ACCEPTED);
    /** Candidature close : plus de rendez-vous possible */
    private static final Set<ApplicationStatus> CLOSED = EnumSet.of(ApplicationStatus.HIRED, ApplicationStatus.WITHDRAWN);

    private final InterviewSlotRepository slots;
    private final ApplicationRepository applications;
    private final ApplicationActivityRepository activities;
    private final CandidateRepository candidates;
    private final CompanyRepository companies;
    private final UserRepository users;
    private final RecruiterService recruiterService;
    private final NotificationService notifications;
    private final HtmlMailer mailer;
    private final InterviewCalendar calendar;

    /** Qui lit la réponse : le titre de l'événement Google Agenda change */
    private enum Audience { RECRUITER, CANDIDATE }

    public InterviewSlotService(InterviewSlotRepository slots, ApplicationRepository applications,
                                ApplicationActivityRepository activities, CandidateRepository candidates,
                                CompanyRepository companies, UserRepository users, RecruiterService recruiterService,
                                NotificationService notifications, HtmlMailer mailer, InterviewCalendar calendar) {
        this.slots = slots;
        this.applications = applications;
        this.activities = activities;
        this.candidates = candidates;
        this.companies = companies;
        this.users = users;
        this.recruiterService = recruiterService;
        this.notifications = notifications;
        this.mailer = mailer;
        this.calendar = calendar;
    }

    // ══ Recruteur ═══════════════════════════════════════════

    @Transactional(readOnly = true)
    public InterviewSlots forRecruiter(Principal principal, Long applicationId) {
        return view(recruiterApplication(principal, applicationId), Audience.RECRUITER);
    }

    /**
     * Propose 1 à 3 créneaux. Remplace les créneaux encore en attente ; si un entretien était déjà fixé,
     * il est annulé (reprogrammation) et retiré du suivi du candidat.
     */
    @Transactional
    public ProposeResult propose(Principal principal, Long applicationId, ProposeRequest req) {
        Application app = recruiterApplication(principal, applicationId);
        if (CLOSED.contains(app.getStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Cette candidature est close.");
        }
        validate(req.slots());

        // Créneaux précédents : remplacés
        boolean rescheduled = false;
        for (InterviewSlot old : slots.findByApplicationIdAndStatusInOrderByStartsAtAsc(app.getId(), OPEN)) {
            if (old.getStatus() == Status.ACCEPTED) {
                rescheduled = true;
                removeActivity(old);
            }
            old.setStatus(Status.CANCELLED);
            old.setRespondedAt(LocalDateTime.now());
        }

        List<InterviewSlot> created = new ArrayList<>();
        for (SlotRequest s : req.slots()) {
            created.add(slots.save(InterviewSlot.builder()
                    .application(app)
                    .startsAt(s.startsAt().withSecond(0).withNano(0))
                    .durationMinutes(s.durationMinutes())
                    .mode(s.mode())
                    .location(blankToNull(s.location()))
                    .proposedBy(Author.RECRUITER)
                    .status(Status.PROPOSED)
                    .build()));
        }

        String message = blankToNull(req.message());
        ApplicantResponse applicant = null;
        if (app.getStatus() != ApplicationStatus.INTERVIEW) {
            // Passage à « Entretien » : notification + e-mail de décision (avec les créneaux dans le message)
            applicant = recruiterService.updateApplicantStatus(principal, app.getId(), ApplicationStatus.INTERVIEW,
                    withSlots(message, created));
        } else {
            notifyCandidateOfSlots(app, created, message, rescheduled);
        }
        log.info("Candidature {} : {} créneau(x) d'entretien proposé(s)", app.getId(), created.size());
        return new ProposeResult(applicant, view(app, Audience.RECRUITER));
    }

    /** Le recruteur accepte le moment proposé par le candidat */
    @Transactional
    public InterviewSlots confirmCandidateProposal(Principal principal, Long applicationId, Long slotId, ConfirmRequest req) {
        Application app = recruiterApplication(principal, applicationId);
        InterviewSlot slot = openSlot(app, slotId, Author.CANDIDATE);
        slot.setMode(req.mode());
        slot.setLocation(blankToNull(req.location()));
        accept(app, slot);

        Candidate candidate = app.getCandidate();
        String when = DAY_TIME.format(slot.getStartsAt());
        notifications.notify(candidate.getUser(), "INTERVIEW_CONFIRMED", "Entretien confirmé",
                company(app).getName() + " confirme votre entretien " + when + " (" + modeLabel(slot.getMode()) + ").",
                "/app/candidatures");
        mailConfirmation(candidateEmail(candidate), candidate.getFirstName(), app, slot,
                company(app).getName() + " a accepté le moment que vous avez proposé.", Audience.CANDIDATE);
        return view(app, Audience.RECRUITER);
    }

    // ══ Candidat ════════════════════════════════════════════

    @Transactional(readOnly = true)
    public InterviewSlots forCandidate(Principal principal, Long applicationId) {
        return view(candidateApplication(principal, applicationId), Audience.CANDIDATE);
    }

    /** Le candidat choisit un des créneaux du recruteur */
    @Transactional
    public InterviewSlots acceptSlot(Principal principal, Long applicationId, Long slotId) {
        Application app = candidateApplication(principal, applicationId);
        requireInterview(app);
        InterviewSlot slot = openSlot(app, slotId, Author.RECRUITER);
        accept(app, slot);

        Candidate candidate = app.getCandidate();
        String name = fullName(candidate);
        String when = DAY_TIME.format(slot.getStartsAt());
        User owner = company(app).getOwner();
        notifications.notify(owner, "INTERVIEW_CONFIRMED", "Créneau choisi",
                name + " a choisi le créneau du " + when + " pour « " + jobTitle(app) + " ».", recruiterLink(app));
        mailConfirmation(recruiterEmail(app), owner != null ? owner.getFirstName() : null, app, slot,
                name + " a choisi ce créneau pour l'entretien.", Audience.RECRUITER);
        mailConfirmation(candidateEmail(candidate), candidate.getFirstName(), app, slot,
                "Votre entretien avec " + company(app).getName() + " est confirmé.", Audience.CANDIDATE);
        return view(app, Audience.CANDIDATE);
    }

    /** Aucun créneau ne convient : le candidat propose un autre moment */
    @Transactional
    public InterviewSlots counterPropose(Principal principal, Long applicationId, CounterRequest req) {
        Application app = candidateApplication(principal, applicationId);
        requireInterview(app);
        LocalDateTime startsAt = req.startsAt().withSecond(0).withNano(0);

        List<InterviewSlot> open = slots.findByApplicationIdAndStatusInOrderByStartsAtAsc(app.getId(), OPEN);
        if (open.stream().anyMatch(s -> s.getStatus() == Status.ACCEPTED)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Un entretien est déjà fixé. Le recruteur peut le reprogrammer si besoin.");
        }
        // Le format et la durée suivent ceux du recruteur
        InterviewSlot model = open.stream().filter(s -> s.getProposedBy() == Author.RECRUITER).findFirst().orElse(null);
        for (InterviewSlot s : open) {
            s.setStatus(s.getProposedBy() == Author.RECRUITER ? Status.DECLINED : Status.CANCELLED);
            s.setRespondedAt(LocalDateTime.now());
        }

        String message = blankToNull(req.message());
        InterviewSlot proposal = slots.save(InterviewSlot.builder()
                .application(app)
                .startsAt(startsAt)
                .durationMinutes(model != null ? model.getDurationMinutes() : 60)
                .mode(model != null ? model.getMode() : Mode.VIDEO)
                .location(model != null ? model.getLocation() : null)
                .proposedBy(Author.CANDIDATE)
                .status(Status.PROPOSED)
                .message(message)
                .build());

        String name = fullName(app.getCandidate());
        String when = DAY_TIME.format(proposal.getStartsAt());
        User owner = company(app).getOwner();
        notifications.notify(owner, "INTERVIEW_COUNTER", "Autre moment proposé",
                name + " propose le " + when + " pour l'entretien « " + jobTitle(app) + " »."
                        + (message == null ? "" : "\n\n« " + message + " »"),
                recruiterLink(app));
        mailer.send(new HtmlMail()
                .to(recruiterEmail(app))
                .subject("Entretien : " + name + " propose un autre moment")
                .label("Entretien")
                .colors("#7c3aed", "#f5f3ff")
                .headline(name + " propose un autre moment")
                .greeting(owner != null ? owner.getFirstName() : null)
                .intro("Les créneaux proposés ne conviennent pas au candidat pour le poste « " + jobTitle(app) + " ».")
                .card("Moment proposé", capitalize(when), proposal.getDurationMinutes() + " min · " + modeLabel(proposal.getMode()))
                .quote(message == null ? null : "Message du candidat", message)
                .steps("Acceptez ce moment en un clic depuis votre espace,",
                        "ou proposez-lui d'autres créneaux.")
                .cta("Répondre", recruiterLink(app))
                .footer("Vous recevez cet e-mail car vous avez proposé un entretien sur JobRadar."));
        return view(app, Audience.CANDIDATE);
    }

    // ══ Règles communes ═════════════════════════════════════

    /** Accepte le créneau, écarte les autres, ajoute l'entretien dans le suivi du candidat */
    private void accept(Application app, InterviewSlot slot) {
        if (!slot.getStartsAt().isAfter(LocalDateTime.now())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Ce créneau est déjà passé. Proposez-en un autre.");
        }
        LocalDateTime now = LocalDateTime.now();
        for (InterviewSlot other : slots.findByApplicationIdAndStatusInOrderByStartsAtAsc(app.getId(), OPEN)) {
            if (Objects.equals(other.getId(), slot.getId())) continue;
            if (other.getStatus() == Status.ACCEPTED) removeActivity(other);
            other.setStatus(Status.DECLINED);
            other.setRespondedAt(now);
        }
        ApplicationActivity activity = activities.save(ApplicationActivity.builder()
                .application(app)
                .type(ActivityType.INTERVIEW)
                .title(truncate("Entretien — " + company(app).getName(), 150))
                .scheduledAt(slot.getStartsAt())
                .location(slot.getLocation())
                .details(modeLabel(slot.getMode()) + " · " + slot.getDurationMinutes() + " min · fixé via JobRadar")
                .done(false)
                .build());
        slot.setStatus(Status.ACCEPTED);
        slot.setRespondedAt(now);
        slot.setActivityId(activity.getId());
    }

    private InterviewSlots view(Application app, Audience audience) {
        List<InterviewSlot> open = slots.findByApplicationIdAndStatusInOrderByStartsAtAsc(app.getId(), OPEN);
        InterviewSlot accepted = open.stream().filter(s -> s.getStatus() == Status.ACCEPTED).reduce((a, b) -> b).orElse(null);
        SlotItem confirmed = accepted == null ? null : SlotItem.from(accepted);
        // Les propositions ne comptent que tant que la candidature est à l'étape « Entretien »
        List<SlotItem> proposals = app.getStatus() != ApplicationStatus.INTERVIEW ? List.of()
                : open.stream().filter(s -> s.getStatus() == Status.PROPOSED).map(SlotItem::from).toList();

        State state;
        if (proposals.stream().anyMatch(s -> s.proposedBy() == Author.CANDIDATE)) state = State.WAITING_RECRUITER;
        else if (!proposals.isEmpty()) state = State.WAITING_CANDIDATE;
        else if (confirmed != null) state = State.CONFIRMED;
        else state = State.NONE;
        return new InterviewSlots(state, proposals, confirmed,
                accepted == null ? null : calendarUrl(app, accepted, audience));
    }

    /** Lien Google Agenda : le candidat voit l'entreprise, le recruteur voit le nom du candidat */
    private String calendarUrl(Application app, InterviewSlot slot, Audience audience) {
        boolean recruiter = audience == Audience.RECRUITER;
        String who = recruiter ? fullName(app.getCandidate()) : company(app).getName();
        return calendar.googleUrl(
                truncate("Entretien — " + who + " · " + jobTitle(app), 200),
                slot.getStartsAt(), slot.endsAt(), modeLabel(slot.getMode()), slot.getLocation(),
                recruiter ? recruiterLink(app) : "/app/candidatures");
    }

    private void validate(List<SlotRequest> requested) {
        LocalDateTime min = LocalDateTime.now().plusMinutes(30);
        Set<LocalDateTime> seen = new HashSet<>();
        for (SlotRequest s : requested) {
            if (s.startsAt().isBefore(min)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Chaque créneau doit commencer au moins 30 minutes après maintenant.");
            }
            if (!seen.add(s.startsAt().withSecond(0).withNano(0))) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Deux créneaux sont identiques.");
            }
        }
    }

    private InterviewSlot openSlot(Application app, Long slotId, Author expectedAuthor) {
        InterviewSlot slot = slots.findByIdAndApplicationId(slotId, app.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Créneau introuvable."));
        if (slot.getStatus() != Status.PROPOSED || slot.getProposedBy() != expectedAuthor) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Ce créneau n'est plus disponible. Rechargez la page.");
        }
        return slot;
    }

    private static void requireInterview(Application app) {
        if (app.getStatus() != ApplicationStatus.INTERVIEW) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Cette candidature n'est plus à l'étape entretien.");
        }
    }

    /** L'entretien annulé disparaît du suivi du candidat (s'il ne l'a pas déjà supprimé) */
    private void removeActivity(InterviewSlot slot) {
        if (slot.getActivityId() != null) {
            activities.findById(slot.getActivityId()).ifPresent(activities::delete);
            slot.setActivityId(null);
        }
    }

    // ══ Accès ═══════════════════════════════════════════════

    private Application recruiterApplication(Principal principal, Long applicationId) {
        Company company = companies.findByOwnerId(currentUser(principal).getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT,
                        "Créez d'abord le profil de votre entreprise."));
        return applications.findById(applicationId)
                .filter(a -> a.getJobOffer() != null && a.getJobOffer().getPublisher() != null
                        && Objects.equals(a.getJobOffer().getPublisher().getId(), company.getId()))
                .filter(a -> a.getStatus() != ApplicationStatus.TO_APPLY)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Candidature introuvable."));
    }

    private Application candidateApplication(Principal principal, Long applicationId) {
        Candidate candidate = candidates.findByUserId(currentUser(principal).getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT,
                        "Complétez d'abord votre profil candidat."));
        return applications.findByIdAndCandidateId(applicationId, candidate.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Candidature introuvable."));
    }

    private User currentUser(Principal principal) {
        if (principal == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Connexion requise.");
        return users.findByEmail(principal.getName())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Utilisateur introuvable."));
    }

    // ══ Messages ════════════════════════════════════════════

    private void notifyCandidateOfSlots(Application app, List<InterviewSlot> created, String message, boolean rescheduled) {
        Candidate candidate = app.getCandidate();
        String companyName = company(app).getName();
        String title = rescheduled ? "Entretien à reprogrammer" : "Nouveaux créneaux d'entretien";
        String intro = rescheduled
                ? companyName + " doit déplacer votre entretien pour « " + jobTitle(app) + " » et vous propose de nouveaux créneaux."
                : companyName + " vous propose de nouveaux créneaux pour l'entretien « " + jobTitle(app) + " ».";
        notifications.notify(candidate.getUser(), "INTERVIEW_SLOTS", title,
                intro + (message == null ? "" : "\n\n« " + message + " »"), "/app/candidatures");
        mailer.send(new HtmlMail()
                .to(candidateEmail(candidate))
                .subject(title + " — " + jobTitle(app))
                .label("Entretien")
                .colors("#7c3aed", "#f5f3ff")
                .headline(rescheduled ? "Votre entretien doit être déplacé" : "Choisissez votre créneau")
                .greeting(candidate.getFirstName())
                .intro(intro)
                .quote(message == null ? null : "Message du recruteur", message)
                .steps(created.stream().map(InterviewSlotService::slotLine).toArray(String[]::new))
                .cta("Choisir un créneau", "/app/candidatures")
                .footer("Vous recevez cet e-mail car vous avez postulé via JobRadar."));
    }

    private void mailConfirmation(String to, String firstName, Application app, InterviewSlot slot, String intro,
                                  Audience audience) {
        boolean toRecruiter = audience == Audience.RECRUITER;
        mailer.send(new HtmlMail()
                .to(to)
                .subject("Entretien confirmé — " + jobTitle(app))
                .label("Entretien confirmé")
                .colors("#15803d", "#e7f6ec")
                .headline("Entretien confirmé")
                .greeting(firstName)
                .intro(intro)
                .card(capitalize(DAY_TIME.format(slot.getStartsAt())),
                        jobTitle(app),
                        TIME.format(slot.getStartsAt()) + " – " + TIME.format(slot.endsAt()) + " · " + modeLabel(slot.getMode())
                                + (slot.getLocation() == null ? "" : " · " + slot.getLocation()))
                .steps(toRecruiter
                        ? new String[]{"L'entretien est noté dans le suivi du candidat.",
                                       "Besoin de le déplacer ? Proposez de nouveaux créneaux depuis votre espace."}
                        : new String[]{"L'entretien est ajouté dans Suivi → Événements de votre candidature.",
                                       "Relisez l'offre et préparez quelques exemples concrets."})
                .cta(toRecruiter ? "Voir la candidature" : "Voir ma candidature",
                        toRecruiter ? recruiterLink(app) : "/app/candidatures")
                .secondary("Ajouter à Google Agenda", calendarUrl(app, slot, audience))
                .footer("E-mail envoyé par JobRadar."));
    }

    /** Message de décision « Entretien » : message du recruteur + liste des créneaux */
    private static String withSlots(String message, List<InterviewSlot> created) {
        StringBuilder text = new StringBuilder(message == null ? "" : message + "\n\n");
        text.append("Créneaux proposés (choisissez-en un dans JobRadar) :");
        for (InterviewSlot s : created) text.append("\n• ").append(slotLine(s));
        return text.toString();
    }

    private static String slotLine(InterviewSlot s) {
        return capitalize(DAY_TIME.format(s.getStartsAt())) + " – " + TIME.format(s.endsAt())
                + " · " + modeLabel(s.getMode());
    }

    static String modeLabel(Mode mode) {
        return switch (mode) {
            case VIDEO -> "Visio";
            case PHONE -> "Téléphone";
            case ONSITE -> "Sur place";
        };
    }

    private static Company company(Application app) {
        return app.getJobOffer().getPublisher();
    }

    private static String jobTitle(Application app) {
        return app.getJobOffer() != null ? app.getJobOffer().getTitle() : app.getJobTitle();
    }

    private static String recruiterLink(Application app) {
        return "/app/recruteur/offres/" + app.getJobOffer().getId() + "/candidats";
    }

    private static String recruiterEmail(Application app) {
        Company c = company(app);
        String contact = c.getContactEmail();
        if (contact != null && !contact.isBlank()) return contact;
        return c.getOwner() != null ? c.getOwner().getEmail() : null;
    }

    private static String candidateEmail(Candidate c) {
        if (c.getEmail() != null && !c.getEmail().isBlank()) return c.getEmail();
        return c.getUser() != null ? c.getUser().getEmail() : null;
    }

    private static String fullName(Candidate c) {
        String n = ((c.getFirstName() == null ? "" : c.getFirstName()) + " "
                + (c.getLastName() == null ? "" : c.getLastName())).strip();
        return n.isEmpty() ? "Le candidat" : n;
    }

    private static String capitalize(String v) {
        return v == null || v.isEmpty() ? v : Character.toUpperCase(v.charAt(0)) + v.substring(1);
    }

    private static String blankToNull(String v) {
        return v == null || v.isBlank() ? null : v.strip();
    }

    private static String truncate(String v, int max) {
        return v.length() <= max ? v : v.substring(0, max);
    }
}
