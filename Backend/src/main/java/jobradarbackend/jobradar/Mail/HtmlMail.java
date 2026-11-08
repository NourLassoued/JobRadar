package jobradarbackend.jobradar.Mail;

import java.util.ArrayList;
import java.util.List;


public final class HtmlMail {

    String to;
    String subject;
    /** Petite étiquette colorée au-dessus du titre (« Nouvelle candidature ») */
    String label;
    /** Couleur principale (bandeau, étiquette, bouton) et sa version claire */
    String accent = "#155e63";
    String accentSoft = "#e2efee";
    String headline;
    /** Prénom pour « Bonjour Nour, » (null : « Bonjour, ») */
    String greetingName;
    String intro;
    /** Carte grise : étiquette, titre, sous-titre et pastille (ex. « Compatibilité 91 % ») */
    String cardLabel = "Offre";
    String cardTitle;
    String cardSubtitle;
    String highlight;
    /** Encadré facultatif (message du recruteur, compétences communes…) */
    String quoteLabel;
    String quote;
    String stepsLabel = "Et maintenant ?";
    List<String> steps = new ArrayList<>();
    String ctaLabel;
    /** Chemin dans l'application, par exemple /app/candidatures */
    String ctaPath;
    /** Phrase du pied de page : pourquoi la personne reçoit cet e-mail */
    String footer;

    public HtmlMail to(String v) { to = v; return this; }
    public HtmlMail subject(String v) { subject = v; return this; }
    public HtmlMail label(String v) { label = v; return this; }
    public HtmlMail colors(String accent, String accentSoft) { this.accent = accent; this.accentSoft = accentSoft; return this; }
    public HtmlMail headline(String v) { headline = v; return this; }
    public HtmlMail greeting(String firstName) { greetingName = firstName; return this; }
    public HtmlMail intro(String v) { intro = v; return this; }
    public HtmlMail card(String label, String title, String subtitle) {
        cardLabel = label; cardTitle = title; cardSubtitle = subtitle; return this;
    }
    public HtmlMail highlight(String v) { highlight = v; return this; }
    public HtmlMail quote(String label, String text) { quoteLabel = label; quote = text; return this; }
    public HtmlMail steps(String... v) { steps = List.of(v); return this; }
    public HtmlMail cta(String label, String path) { ctaLabel = label; ctaPath = path; return this; }
    public HtmlMail footer(String v) { footer = v; return this; }

    public String to() { return to; }
    public String subject() { return subject; }
}
