package jobradarbackend.jobradar.applications;

import jakarta.annotation.PreDestroy;
import jakarta.mail.internet.MimeMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.thymeleaf.ITemplateEngine;
import org.thymeleaf.context.Context;

import java.time.Year;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * E-mail au candidat pour les décisions du recruteur (entretien, proposition, embauche, refus).
 *
 * - E-mail HTML mis en forme (templates/emails/decision.html) + version texte pour les messageries
 *   qui n'affichent pas le HTML.
 * - Couleur, étiquette, prochaines étapes et bouton adaptés à chaque décision.
 * - Part APRÈS le commit (rien si la décision échoue) et dans un thread à part : le clic du recruteur
 *   reste instantané même si le serveur SMTP met 2 secondes à répondre.
 * - Chaque envoi est écrit dans les logs (réussi, échoué ou désactivé).
 */
@Component
public class DecisionMailer {

    private static final Logger log = LoggerFactory.getLogger(DecisionMailer.class);

    private final ObjectProvider<JavaMailSender> mailSender;
    private final ITemplateEngine templates;
    private final String from;
    private final String frontendUrl;
    private final ExecutorService executor = Executors.newSingleThreadExecutor(r -> {
        Thread t = new Thread(r, "decision-mail");
        t.setDaemon(true);
        return t;
    });

    public DecisionMailer(ObjectProvider<JavaMailSender> mailSender,
                          ITemplateEngine templates,
                          // Par défaut : le compte Gmail configuré (Gmail refuse un autre expéditeur)
                          @Value("${app.mail.from:${spring.mail.username:}}") String from,
                          @Value("${app.frontend-url:http://localhost:4200}") String frontendUrl) {
        this.mailSender = mailSender;
        this.templates = templates;
        this.from = from;
        this.frontendUrl = frontendUrl.replaceAll("/+$", "");
    }

    /**
     * @param to               adresse du candidat
     * @param firstName        prénom du candidat (« Bonjour Nour, »)
     * @param status           décision : INTERVIEW, OFFER, HIRED ou REJECTED
     * @param company          nom de l'entreprise
     * @param jobTitle         intitulé de l'offre
     * @param recruiterMessage message facultatif écrit par le recruteur
     */
    public void send(String to, String firstName, ApplicationStatus status, String company, String jobTitle,
                     String recruiterMessage) {
        if (to == null || to.isBlank()) {
            log.warn("E-mail de décision non envoyé : le candidat n'a pas d'adresse e-mail");
            return;
        }
        JavaMailSender sender = mailSender.getIfAvailable();
        if (sender == null) {
            log.warn("E-mail de décision non envoyé : aucun serveur d'e-mail configuré (spring.mail.*)");
            return;
        }

        Theme theme = Theme.of(status, company, jobTitle);
        String message = recruiterMessage == null || recruiterMessage.isBlank() ? null : recruiterMessage.strip();
        String name = firstName == null || firstName.isBlank() ? "" : capitalize(firstName.strip());
        String subject = theme.headline() + " — " + jobTitle;

        // Construit maintenant (dans la requête), envoyé après le commit
        String html;
        try {
            html = renderHtml(theme, name, company, jobTitle, message);
        } catch (RuntimeException e) {
            log.warn("Modèle d'e-mail emails/decision.html illisible : {}", e.getMessage());
            return;
        }
        String text = renderText(theme, name, company, jobTitle, message);

        afterCommit(() -> executor.submit(() -> {
            try {
                MimeMessage mime = sender.createMimeMessage();
                MimeMessageHelper helper = new MimeMessageHelper(mime, true, "UTF-8");
                if (from != null && !from.isBlank()) helper.setFrom(from, "JobRadar");
                helper.setTo(to);
                helper.setSubject(subject);
                helper.setText(text, html); // version texte + version HTML
                sender.send(mime);
                log.info("E-mail de décision envoyé à {} : {}", mask(to), subject);
            } catch (Exception e) {
                log.warn("E-mail de décision non envoyé à {} : {}", mask(to), e.getMessage());
            }
        }));
    }

    // ── Contenu ──────────────────────────────────────────────

    /** Couleur, textes, prochaines étapes et bouton propres à chaque décision */
    private record Theme(String statusLabel, String accent, String accentSoft, String headline, String intro,
                         List<String> nextSteps, String ctaLabel, String ctaPath) {

        static Theme of(ApplicationStatus status, String company, String job) {
            return switch (status) {
                case INTERVIEW -> new Theme("Entretien", "#155e63", "#e2efee",
                        "Entretien proposé",
                        company + " a retenu votre candidature et souhaite vous rencontrer pour le poste «\u00a0" + job + "\u00a0».",
                        List.of("Le recruteur vous contactera pour fixer la date et le format de l'entretien.",
                                "Relisez l'offre et votre CV pour préparer vos exemples.",
                                "Suivez l'avancement de votre candidature dans votre espace."),
                        "Voir ma candidature", "/app/candidatures");
                case OFFER -> new Theme("Proposition", "#4338ca", "#eef0ff",
                        "Vous avez reçu une proposition",
                        company + " vous fait une proposition d'embauche pour le poste «\u00a0" + job + "\u00a0».",
                        List.of("Prenez connaissance des détails de la proposition.",
                                "Répondez au recruteur pour confirmer votre décision."),
                        "Voir la proposition", "/app/candidatures");
                case HIRED -> new Theme("Embauche", "#15803d", "#e7f6ec",
                        "Félicitations, vous êtes embauché(e) !",
                        company + " confirme votre embauche pour le poste «\u00a0" + job + "\u00a0». Bravo pour ce beau parcours !",
                        List.of("Le recruteur vous contactera pour le contrat et la date d'arrivée.",
                                "Pensez à mettre à jour votre profil JobRadar."),
                        "Voir ma candidature", "/app/candidatures");
                case REJECTED -> new Theme("Réponse", "#55626d", "#eef1f3",
                        "Réponse à votre candidature",
                        "Merci pour l'intérêt que vous portez à " + company + ". Après étude de votre profil, "
                                + "votre candidature pour le poste «\u00a0" + job + "\u00a0» n'a pas été retenue cette fois-ci.",
                        List.of("Votre profil reste visible : d'autres offres peuvent vous correspondre.",
                                "Consultez les offres recommandées selon vos compétences."),
                        "Voir les offres recommandées", "/app/offres");
                default -> new Theme("Mise à jour", "#155e63", "#e2efee",
                        "Mise à jour de votre candidature",
                        "Le statut de votre candidature pour le poste «\u00a0" + job + "\u00a0» a changé.",
                        List.of(), "Voir ma candidature", "/app/candidatures");
            };
        }
    }

    private String renderHtml(Theme t, String firstName, String company, String job, String message) {
        Context ctx = new Context(Locale.FRENCH);
        ctx.setVariable("statusLabel", t.statusLabel());
        ctx.setVariable("accent", t.accent());
        ctx.setVariable("accentSoft", t.accentSoft());
        ctx.setVariable("headline", t.headline());
        ctx.setVariable("preheader", t.intro());
        ctx.setVariable("firstName", firstName.isEmpty() ? "à vous" : firstName);
        ctx.setVariable("intro", t.intro());
        ctx.setVariable("jobTitle", job);
        ctx.setVariable("company", company);
        ctx.setVariable("message", message);
        ctx.setVariable("nextSteps", t.nextSteps());
        ctx.setVariable("ctaLabel", t.ctaLabel());
        ctx.setVariable("ctaUrl", frontendUrl + t.ctaPath());
        ctx.setVariable("appUrl", frontendUrl + "/app/candidatures");
        ctx.setVariable("year", Year.now().getValue());
        return templates.process("emails/decision", ctx);
    }

    private String renderText(Theme t, String firstName, String company, String job, String message) {
        StringBuilder s = new StringBuilder();
        s.append(t.headline()).append("\n\n");
        s.append("Bonjour").append(firstName.isEmpty() ? "" : " " + firstName).append(",\n\n");
        s.append(t.intro()).append("\n\n");
        s.append("Offre : ").append(job).append(" — ").append(company).append("\n\n");
        if (message != null) s.append("Message du recruteur :\n").append(message).append("\n\n");
        for (int i = 0; i < t.nextSteps().size(); i++) {
            s.append(i + 1).append(". ").append(t.nextSteps().get(i)).append("\n");
        }
        if (!t.nextSteps().isEmpty()) s.append("\n");
        s.append(t.ctaLabel()).append(" : ").append(frontendUrl).append(t.ctaPath()).append("\n\n— JobRadar");
        return s.toString();
    }

    // ── Outils ───────────────────────────────────────────────

    private static void afterCommit(Runnable task) {
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

    private static String capitalize(String value) {
        return value.substring(0, 1).toUpperCase(Locale.FRENCH) + value.substring(1);
    }

    /** n***@gmail.com : on ne met pas l'adresse complète dans les logs */
    private static String mask(String email) {
        int at = email.indexOf('@');
        return at <= 1 ? "***" + email.substring(Math.max(at, 0)) : email.charAt(0) + "***" + email.substring(at);
    }

    @PreDestroy
    void shutdown() {
        executor.shutdown();
    }
}