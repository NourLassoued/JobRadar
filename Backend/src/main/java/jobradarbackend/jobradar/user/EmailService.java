package jobradarbackend.jobradar.user;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import org.thymeleaf.TemplateEngine;
import org.thymeleaf.context.Context;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import org.thymeleaf.spring6.SpringTemplateEngine;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

import static java.awt.SystemColor.text;

/**
 * Service pour gérer l'envoi d'emails
 * - Welcome email (register email/OAuth)
 * - Reset password email
 * - Emails génériques
 */
@Service

@Slf4j
public class EmailService {

    private final JavaMailSender mailSender;
    private final SpringTemplateEngine templateEngine;

    @Value("${app.url.frontend:http://localhost:4200}")
    private String appFrontendUrl;
    @Value("${spring.mail.username}")
    private String from;

    public EmailService(JavaMailSender mailSender, SpringTemplateEngine templateEngine) {
        this.mailSender = mailSender;
        this.templateEngine = templateEngine;
    }

    @Value("${spring.mail.username}")
    private String fromEmail;

    @Value("${app.mail.from-name:JobRadar}")
    private String fromName;

    /**
     * Envoyer email de bienvenue après inscription (email ou OAuth)
     */
    public void sendWelcomeEmail(String to, String firstName, String authMethod) {
        try {
            Context context = new Context();

            String candidateName = (firstName != null && !firstName.trim().isEmpty())
                    ? firstName
                    : "Candidat";

            context.setVariable("candidateName", candidateName);
            context.setVariable("appUrl", appFrontendUrl);
            context.setVariable("profileUrl", appFrontendUrl + "/app/profil");

            String htmlContent = templateEngine.process("emails/email-welcome", context);
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            helper.setTo(to);
            helper.setSubject("Bienvenue sur JobRadar");
            helper.setText(htmlContent, true);

            mailSender.send(message);
            log.info("✅ Welcome email sent to: {} (Name: {}) | Profile URL: {}",
                    to, candidateName, appFrontendUrl + "/app/profil");
        } catch (Exception e) {
            log.error("❌ Failed to send welcome email: {}", e.getMessage());
        }
    }
    /**
     * Envoyer email de réinitialisation de mot de passe
     */
    public void sendResetPasswordEmail(String candidateEmail, String candidateName, String resetToken) {
        try {
            log.info("Sending reset password email to: {}", candidateEmail);

            // Créer contexte Thymeleaf
            Context context = new Context();
            context.setVariable("candidateName", candidateName);
            context.setVariable("resetToken", resetToken);
            context.setVariable("resetUrl", "https://jobradar.fr/reset-password?token=" + resetToken);

            // Générer HTML depuis template
            String emailContent = templateEngine.process("emails/reset-password", context);

            // Envoyer
            sendHtmlEmail(
                    candidateEmail,
                    "Réinitialise ton mot de passe JobRadar 🔐",
                    emailContent
            );

            log.info("✅ Reset password email sent successfully to: {}", candidateEmail);
        } catch (Exception e) {
            log.error("❌ Error sending reset password email to {}: {}", candidateEmail, e.getMessage(), e);
        }
    }

    /**
     * Envoyer email HTML générique
     * Utilisé en interne par les autres méthodes
     */
    private void sendHtmlEmail(String to, String subject, String htmlContent) throws MessagingException {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true);  // ← Remove UTF-8

            helper.setFrom(fromEmail, fromName);
            helper.setTo(to);
            helper.setSubject(subject);
            helper.setText(htmlContent, true);

            mailSender.send(message);
        } catch (Exception e) {
            log.error("❌ Error sending email: {}", e.getMessage());
            throw new MessagingException("Failed to send email", e);
        }
    }
        /**
         * Envoyer email TEXT générique (pour les cas simples)
         */
        public void sendSimpleEmail (String to, String subject, String text){
            try {
                log.info("Sending simple email to: {}", to);

                SimpleMailMessage message = new SimpleMailMessage();
                message.setFrom(fromEmail);
                message.setTo(to);
                message.setSubject(subject);
                message.setText(text);

                mailSender.send(message);

                log.info("✅ Simple email sent successfully to: {}", to);
            } catch (Exception e) {
                log.error("❌ Error sending simple email to {}: {}", to, e.getMessage(), e);
            }
        }
    public void sendLoveEmail(String to) throws MessagingException, IOException {
        // 1. Charger le template HTML
        String html = new ClassPathResource("templates/emails/email-luffy.html")
                .getContentAsString(StandardCharsets.UTF_8);

        // 2. Remplacer le cœur emoji par le GIF animé
        html = html.replace(
                "<span class=\"beat\">❤️</span>",
                "<img src=\"cid:coeur\" width=\"160\" alt=\"❤️\" style=\"display:block;margin:0 auto;\">"
        );

        // 3. Construire l'email
        MimeMessage message = mailSender.createMimeMessage();
        MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

        helper.setFrom(from);
        helper.setTo(to);
        helper.setSubject("Une petite surprise pour toi ❤️");
        helper.setText(html, true);

        // 4. Ajouter le GIF intégré (après setText)
        helper.addInline("coeur", new ClassPathResource("static/coeur-anime.gif"), "image/gif");

        mailSender.send(message);
    }
}