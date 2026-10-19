package jobradarbackend.jobradar.matching;

import jobradarbackend.jobradar.joboffer.JobOffer;

import java.text.Normalizer;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Outils d'analyse du texte d'une offre (sans état, réutilisable par toutes les stratégies).
 */
public final class OfferTextAnalyzer {

    /** « 3 ans », « 3 années », « 5+ years », « 2 à 4 ans » (on garde le premier nombre) */
    private static final Pattern YEARS = Pattern.compile(
            "(\\d{1,2})\\s*\\+?\\s*(?:a|à|-|to)?\\s*(?:\\d{1,2})?\\s*(?:ans|an|annees|annee|years|year|yrs)\\b");

    private OfferTextAnalyzer() {
    }

    /** Minuscules, sans accents, espaces normalisés */
    public static String normalize(String text) {
        if (text == null) return "";
        return Normalizer.normalize(text, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT)
                .replaceAll("\\s+", " ")
                .trim();
    }

    /** Titre + description + exigences, normalisés */
    public static String offerText(JobOffer offer) {
        return normalize(String.join(" ",
                nullToEmpty(offer.getTitle()),
                nullToEmpty(offer.getDescription()),
                nullToEmpty(offer.getRequirements())));
    }

    /**
     * La compétence apparaît-elle comme mot entier ?
     * « Java » ne doit pas correspondre à « JavaScript » ; « C++ », « Node.js » sont gérés.
     */
    public static boolean containsSkill(String normalizedText, String skill) {
        String s = normalize(skill);
        if (s.isEmpty()) return false;
        return wholeWord(s).matcher(normalizedText).find();
    }

    /** Motif « mot entier » pour un terme déjà normalisé (« java » ≠ « javascript », « c++ » géré) */
    public static Pattern wholeWord(String normalizedTerm) {
        return Pattern.compile("(?<![a-z0-9])" + Pattern.quote(normalizedTerm) + "(?![a-z0-9+#])");
    }

    /**
     * Années d'expérience demandées, déduites du texte ; null si rien n'est précisé.
     * « débutant accepté », « junior » → 0 ; « senior » → 5.
     */
    public static Integer requiredYears(String normalizedText) {
        Matcher m = YEARS.matcher(normalizedText);
        Integer best = null;
        while (m.find()) {
            int years = Integer.parseInt(m.group(1));
            // On ignore les valeurs aberrantes (ex. « 20 ans d'existence » de l'entreprise)
            if (years <= 15) {
                best = best == null ? years : Math.min(best, years);
            }
        }
        if (best != null) return best;
        if (normalizedText.contains("debutant accepte") || normalizedText.contains("debutant(e) accepte")
                || normalizedText.contains("junior") || normalizedText.contains("sans experience")) {
            return 0;
        }
        if (normalizedText.contains("senior") || normalizedText.contains("confirme")) {
            return 5;
        }
        return null;
    }

    private static String nullToEmpty(String s) {
        return s == null ? "" : s;
    }
}