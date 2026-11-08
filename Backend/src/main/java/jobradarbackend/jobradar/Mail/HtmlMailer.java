package jobradarbackend.jobradar.Mail;

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
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Envoi des e-mails HTML JobRadar (nouvelle candidature, confirmation, offre compatible…).
 *
 * - Un seul modèle : templates/emails/jobradar.html, + une version texte.
 * - Part APRÈS le commit (rien si l'action échoue) et dans un thread à part (l'utilisateur n'attend pas Gmail).
 * - Chaque envoi est tracé dans les logs, adresse masquée.
 */
@Component
public class HtmlMailer {

    private static final Logger log = LoggerFactory.getLogger(HtmlMailer.class);

    private final ObjectProvider<JavaMailSender> mailSender;
    private final ITemplateEngine templates;
    private final String from;
    private final String frontendUrl;
    private final ExecutorService executor = Executors.newSingleThreadExecutor(r -> {
        Thread t = new Thread(r, "jobradar-mail");
        t.setDaemon(true);
        return t;
    });

    public HtmlMailer(ObjectProvider<JavaMailSender> mailSender,
                      ITemplateEngine templates,
                      @Value("${app.mail.from:${spring.mail.username:}}") String from,
                      @Value("${app.frontend-url:http://localhost:4200}") String frontendUrl) {
        this.mailSender = mailSender;
        this.templates = templates;
        this.from = from;
        this.frontendUrl = frontendUrl.replaceAll("/+$", "");
    }

    public void send(HtmlMail mail) {
        if (mail.to == null || mail.to.isBlank()) {
            log.warn("E-mail « {} » non envoyé : pas d'adresse", mail.subject);
            return;
        }
        JavaMailSender sender = mailSender.getIfAvailable();
        if (sender == null) {
            log.warn("E-mail « {} » non envoyé : aucun serveur d'e-mail configuré (spring.mail.*)", mail.subject);
            return;
        }

        String html;
        try {
            html = renderHtml(mail);
        } catch (RuntimeException e) {
            log.warn("Modèle d'e-mail emails/jobradar.html illisible : {}", e.getMessage());
            return;
        }
        String text = renderText(mail);
        String to = mail.to;
        String subject = mail.subject;

        afterCommit(() -> executor.submit(() -> {
            try {
                MimeMessage mime = sender.createMimeMessage();
                MimeMessageHelper helper = new MimeMessageHelper(mime, true, "UTF-8");
                if (from != null && !from.isBlank()) helper.setFrom(from, "JobRadar");
                helper.setTo(to);
                helper.setSubject(subject);
                helper.setText(text, html);
                sender.send(mime);
                log.info("E-mail envoyé à {} : {}", mask(to), subject);
            } catch (Exception e) {
                log.warn("E-mail non envoyé à {} : {}", mask(to), e.getMessage());
            }
        }));
    }

    private String renderHtml(HtmlMail m) {
        Context ctx = new Context(Locale.FRENCH);
        ctx.setVariable("label", m.label);
        ctx.setVariable("accent", m.accent);
        ctx.setVariable("accentSoft", m.accentSoft);
        ctx.setVariable("headline", m.headline);
        ctx.setVariable("preheader", m.intro);
        ctx.setVariable("greeting", greeting(m.greetingName));
        ctx.setVariable("intro", m.intro);
        ctx.setVariable("cardLabel", m.cardLabel);
        ctx.setVariable("cardTitle", m.cardTitle);
        ctx.setVariable("cardSubtitle", m.cardSubtitle);
        ctx.setVariable("highlight", m.highlight);
        ctx.setVariable("quoteLabel", m.quoteLabel);
        ctx.setVariable("quote", blankToNull(m.quote));
        ctx.setVariable("stepsLabel", m.stepsLabel);
        ctx.setVariable("steps", m.steps);
        ctx.setVariable("ctaLabel", m.ctaLabel);
        ctx.setVariable("ctaUrl", m.ctaPath == null ? null : frontendUrl + m.ctaPath);
        ctx.setVariable("footer", m.footer);
        ctx.setVariable("appUrl", frontendUrl + "/app");
        ctx.setVariable("year", Year.now().getValue());
        return templates.process("emails/jobradar", ctx);
    }

    private String renderText(HtmlMail m) {
        StringBuilder s = new StringBuilder();
        s.append(m.headline).append("\n\n").append(greeting(m.greetingName)).append("\n\n");
        if (m.intro != null) s.append(m.intro).append("\n\n");
        if (m.cardTitle != null) {
            s.append(m.cardLabel).append(" : ").append(m.cardTitle);
            if (m.cardSubtitle != null) s.append(" — ").append(m.cardSubtitle);
            if (m.highlight != null) s.append(" (").append(m.highlight).append(")");
            s.append("\n\n");
        }
        if (blankToNull(m.quote) != null) s.append(m.quoteLabel).append(" :\n").append(m.quote.strip()).append("\n\n");
        for (int i = 0; i < m.steps.size(); i++) s.append(i + 1).append(". ").append(m.steps.get(i)).append("\n");
        if (!m.steps.isEmpty()) s.append("\n");
        if (m.ctaPath != null) s.append(m.ctaLabel).append(" : ").append(frontendUrl).append(m.ctaPath).append("\n\n");
        return s.append("— JobRadar").toString();
    }

    private static String greeting(String firstName) {
        if (firstName == null || firstName.isBlank()) return "Bonjour,";
        String n = firstName.strip();
        return "Bonjour " + n.substring(0, 1).toUpperCase(Locale.FRENCH) + n.substring(1) + ",";
    }

    private static String blankToNull(String v) {
        return v == null || v.isBlank() ? null : v;
    }

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

    /** n***@gmail.com : pas d'adresse complète dans les logs */
    private static String mask(String email) {
        int at = email.indexOf('@');
        return at <= 1 ? "***" + email.substring(Math.max(at, 0)) : email.charAt(0) + "***" + email.substring(at);
    }

    @PreDestroy
    void shutdown() {
        executor.shutdown();
    }
}
