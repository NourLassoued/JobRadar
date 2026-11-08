package jobradarbackend.jobradar.joboffer.quality;

import jobradarbackend.jobradar.joboffer.JobOffer;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

/**
 * Note de qualité d'une offre (0 à 100) avec la liste des problèmes, par règles simples et explicables.
 * Les signaux d'arnaque (argent facile, frais d'inscription, contact WhatsApp…) font fortement baisser la note.
 */
public final class OfferQualityAnalyzer {

    /** Formulations typiques des fausses offres (texte normalisé : minuscules, sans accents) */
    private static final List<Pattern> SCAM_SIGNALS = List.of(
            Pattern.compile("argent facile"),
            Pattern.compile("revenus? (complementaires?|passifs?)"),
            Pattern.compile("sans investissement"),
            Pattern.compile("frais d ?inscription|formation payante|kit de demarrage"),
            Pattern.compile("whatsapp|telegram"),
            Pattern.compile("crypto|bitcoin|forex|trading"),
            Pattern.compile("marketing de reseau|\\bmlm\\b|vente pyramidale"),
            Pattern.compile("gagne[rz]? jusqu a \\d"));

    public record Assessment(int score, List<String> issues, boolean suspicious) {}

    private OfferQualityAnalyzer() {
    }

    public static Assessment assess(JobOffer offer) {
        int score = 100;
        List<String> issues = new ArrayList<>();

        String description = offer.getDescription() == null ? "" : offer.getDescription().strip();
        if (description.length() < 150) {
            score -= 35;
            issues.add("Description très courte");
        } else if (description.length() < 400) {
            score -= 15;
            issues.add("Description courte");
        }

        if (OfferTextSimilarity.companyKey(offer.getCompany()).isEmpty()) {
            score -= 10;
            issues.add("Entreprise non indiquée");
        }
        if (OfferTextSimilarity.cityKey(offer.getLocation()).isEmpty()) {
            score -= 10;
            issues.add("Lieu non indiqué");
        }
        if (offer.getContractType() == null) {
            score -= 5;
            issues.add("Type de contrat non indiqué");
        }
        if (offer.getSalaryMin() == null && offer.getSalaryMax() == null) {
            score -= 5;
            issues.add("Salaire non indiqué");
        }

        String title = offer.getTitle() == null ? "" : offer.getTitle().strip();
        if (title.length() < 5) {
            score -= 15;
            issues.add("Intitulé trop court");
        } else if (title.length() > 10 && uppercaseRatio(title) > 0.7) {
            score -= 5;
            issues.add("Intitulé en majuscules");
        }

        String text = OfferTextSimilarity.normalize(title + " " + description);
        boolean suspicious = SCAM_SIGNALS.stream().anyMatch(p -> p.matcher(text).find());
        if (suspicious) {
            score -= 50;
            issues.add("Formulations suspectes (argent facile, frais, contact par messagerie…)");
        }

        return new Assessment(Math.max(0, score), issues, suspicious);
    }

    private static double uppercaseRatio(String s) {
        long letters = s.chars().filter(Character::isLetter).count();
        if (letters == 0) return 0;
        return (double) s.chars().filter(Character::isUpperCase).count() / letters;
    }
}
