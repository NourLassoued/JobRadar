package jobradarbackend.jobradar.matching;

import jakarta.annotation.PreDestroy;
import jobradarbackend.jobradar.Mail.HtmlMail;
import jobradarbackend.jobradar.Mail.HtmlMailer;
import jobradarbackend.jobradar.candidate.Candidate;
import jobradarbackend.jobradar.candidate.CandidateRepository;
import jobradarbackend.jobradar.joboffer.JobOffer;
import jobradarbackend.jobradar.joboffer.JobOfferRepository;

import jobradarbackend.jobradar.notifications.NotificationService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Alerte « offre compatible » : quand une entreprise publie une offre, chaque candidat du même
 * secteur dont le score de compatibilité atteint le seuil reçoit une notification et un e-mail.
 *
 * Tourne en arrière-plan après la publication : le recruteur n'attend pas le calcul des scores.
 */
@Service
public class JobMatchAlertService {

    private static final Logger log = LoggerFactory.getLogger(JobMatchAlertService.class);

    private final JobOfferRepository jobOfferRepository;
    private final CandidateRepository candidateRepository;
    private final MatchingService matchingService;
    private final NotificationService notifications;
    private final HtmlMailer mailer;
    private final TransactionTemplate tx;
    private final boolean enabled;
    private final int threshold;
    private final int maxAlerts;
    private final ExecutorService executor = Executors.newSingleThreadExecutor(r -> {
        Thread t = new Thread(r, "match-alerts");
        t.setDaemon(true);
        return t;
    });

    public JobMatchAlertService(JobOfferRepository jobOfferRepository,
                                CandidateRepository candidateRepository,
                                MatchingService matchingService,
                                NotificationService notifications,
                                HtmlMailer mailer,
                                PlatformTransactionManager transactionManager,
                                @Value("${app.matching.alerts-enabled:true}") boolean enabled,
                                @Value("${app.matching.alert-threshold:70}") int threshold,
                                @Value("${app.matching.max-alerts-per-offer:200}") int maxAlerts) {
        this.jobOfferRepository = jobOfferRepository;
        this.candidateRepository = candidateRepository;
        this.matchingService = matchingService;
        this.notifications = notifications;
        this.mailer = mailer;
        this.tx = new TransactionTemplate(transactionManager);
        this.enabled = enabled;
        this.threshold = threshold;
        this.maxAlerts = maxAlerts;
    }

    /** Appelé par RecruiterService.createJob : l'alerte part une fois l'offre bien enregistrée */
    public void offerPublished(Long offerId) {
        if (!enabled || offerId == null) return;
        Runnable task = () -> executor.submit(() -> {
            try {
                tx.executeWithoutResult(status -> alertCandidates(offerId));
            } catch (RuntimeException e) {
                log.warn("Alerte de l'offre {} interrompue : {}", offerId, e.getMessage());
            }
        });
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    task.run();
                }
            });
        } else {
            task.run();
        }
    }

    private void alertCandidates(Long offerId) {
        JobOffer offer = jobOfferRepository.findById(offerId).orElse(null);
        if (offer == null || !Boolean.TRUE.equals(offer.getIsActive())) return;

        Long ownerId = offer.getPublisher() != null && offer.getPublisher().getOwner() != null
                ? offer.getPublisher().getOwner().getId() : null;
        String sector = offer.getSector() == null ? null : String.valueOf(offer.getSector());

        // Candidats du même secteur, avec un compte, hors recruteur lui-même ; les plus compatibles d'abord
        List<Scored> matches = candidateRepository.findAll().stream()
                .filter(c -> c.getUser() != null && !Objects.equals(c.getUser().getId(), ownerId))
                .filter(c -> sector == null || (c.getSector() != null && sector.equalsIgnoreCase(String.valueOf(c.getSector()))))
                .map(c -> score(c, offer))
                .filter(s -> s != null && s.result().score() >= threshold)
                .sorted(Comparator.comparingInt((Scored s) -> s.result().score()).reversed())
                .limit(maxAlerts)
                .toList();

        String company = offer.getPublisher() != null ? offer.getPublisher().getName() : offer.getCompany();
        for (Scored s : matches) {
            Candidate c = s.candidate();
            int score = s.result().score();
            notifications.notify(c.getUser(), "NEW_MATCH",
                    "Nouvelle offre pour vous : " + offer.getTitle(),
                    company + " · compatibilité " + score + " %",
                    "/app/offres");
            mailer.send(matchMail(c, offer, company, s.result()));
        }
        log.info("Offre {} : {} candidat(s) compatible(s) prévenu(s) (seuil {} %)", offerId, matches.size(), threshold);
    }

    private HtmlMail matchMail(Candidate c, JobOffer offer, String company, MatchResult m) {
        String to = c.getEmail() != null && !c.getEmail().isBlank() ? c.getEmail() : c.getUser().getEmail();
        String where = offer.getLocation() == null || offer.getLocation().isBlank() ? company : company + " · " + offer.getLocation();
        List<String> skills = m.matchedSkills() == null ? List.of() : m.matchedSkills().stream().limit(6).toList();

        return new HtmlMail()
                .to(to)
                .subject("Nouvelle offre pour vous — " + offer.getTitle())
                .label("Offre compatible")
                .colors("#4338ca", "#eef0ff")
                .headline("Une nouvelle offre correspond à votre profil")
                .greeting(c.getFirstName())
                .intro(company + " vient de publier une offre qui correspond à " + m.score() + " % à votre profil JobRadar.")
                .card("Offre", offer.getTitle(), where)
                .highlight("Compatibilité " + m.score() + " %")
                .quote(skills.isEmpty() ? null : "Vos compétences demandées", String.join(" · ", skills))
                .steps("Consultez l'offre en détail.",
                        "Postulez en quelques clics avec votre CV et votre lettre de motivation.")
                .cta("Voir l'offre et postuler", "/app/offres")
                .footer("Vous recevez cet e-mail car votre profil JobRadar correspond à cette offre.");
    }

    private Scored score(Candidate c, JobOffer offer) {
        try {
            MatchResult r = matchingService.score(c, offer);
            return r == null ? null : new Scored(c, r);
        } catch (RuntimeException e) {
            log.debug("Score impossible pour le candidat {} : {}", c.getId(), e.getMessage());
            return null;
        }
    }

    private record Scored(Candidate candidate, MatchResult result) {}

    @PreDestroy
    void shutdown() {
        executor.shutdown();
    }
}
