package jobradarbackend.jobradar.joboffer.quality;

import java.text.Normalizer;
import java.util.Arrays;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Similarité de textes sans service externe : normalisation, mots, « shingles » (suites de 3 mots)
 * et indice de Jaccard (part de mots / suites en commun, de 0 à 1).
 *
 * Suffisant pour repérer une même offre publiée sur deux sites. Pour une similarité « de sens »
 * (embeddings), il suffira de remplacer cette classe : le reste du contrôle ne change pas.
 */
public final class OfferTextSimilarity {

    private static final Pattern DIACRITICS = Pattern.compile("\\p{M}+");
    private static final Pattern NON_ALNUM = Pattern.compile("[^a-z0-9+#]+");
    /** Mots sans valeur pour comparer deux offres */
    private static final Set<String> STOP_WORDS = Set.of(
            "le", "la", "les", "un", "une", "des", "de", "du", "d", "l", "et", "ou", "en", "a", "au", "aux", "pour",
            "par", "sur", "avec", "dans", "nous", "vous", "votre", "vos", "notre", "nos", "est", "sont", "h", "f", "hf",
            "the", "and", "of", "to", "in", "for", "with", "x", "m", "w");
    private static final Set<String> LEGAL_FORMS = Set.of(
            "sarl", "sas", "sasu", "sa", "eurl", "sci", "snc", "gmbh", "ltd", "inc", "group", "groupe", "france");
    private static final Set<String> UNKNOWN_COMPANIES = Set.of(
            "", "confidentiel", "confidentielle", "entreprise confidentielle", "non communique", "non precise",
            "anonyme", "unknown", "n a");

    private OfferTextSimilarity() {
    }

    /** minuscules, sans accents, ponctuation remplacée par des espaces */
    public static String normalize(String text) {
        if (text == null) return "";
        String t = DIACRITICS.matcher(Normalizer.normalize(text, Normalizer.Form.NFD)).replaceAll("");
        return NON_ALNUM.matcher(t.toLowerCase()).replaceAll(" ").strip();
    }

    /** Mots significatifs (sans « (H/F) », articles…) */
    public static Set<String> words(String text) {
        return Arrays.stream(normalize(text).split(" "))
                .filter(w -> w.length() > 1 && !STOP_WORDS.contains(w))
                .collect(Collectors.toCollection(LinkedHashSet::new));
    }

    /** Suites de 3 mots consécutifs : deux descriptions copiées partagent beaucoup de suites */
    public static Set<String> shingles(String text, int maxChars) {
        String n = normalize(text);
        if (n.length() > maxChars) n = n.substring(0, maxChars);
        List<String> w = Arrays.stream(n.split(" ")).filter(s -> !s.isEmpty() && !STOP_WORDS.contains(s)).toList();
        Set<String> out = new HashSet<>();
        for (int i = 0; i + 2 < w.size(); i++) out.add(w.get(i) + " " + w.get(i + 1) + " " + w.get(i + 2));
        return out;
    }

    /** Indice de Jaccard : |A ∩ B| / |A ∪ B| */
    public static double jaccard(Set<String> a, Set<String> b) {
        if (a.isEmpty() || b.isEmpty()) return 0;
        Set<String> small = a.size() <= b.size() ? a : b;
        Set<String> large = small == a ? b : a;
        long common = small.stream().filter(large::contains).count();
        return (double) common / (a.size() + b.size() - common);
    }

    /** Nom d'entreprise comparable (« ACME SAS » = « Acme ») ; vide si inconnu ou confidentiel */
    public static String companyKey(String company) {
        String n = normalize(company);
        if (UNKNOWN_COMPANIES.contains(n)) return "";
        return Arrays.stream(n.split(" ")).filter(w -> !LEGAL_FORMS.contains(w)).collect(Collectors.joining(" ")).strip();
    }

    /** Ville comparable : « 75 - PARIS 08 » → « paris » ; vide si inconnue */
    public static String cityKey(String location) {
        return Arrays.stream(normalize(location).split(" "))
                .filter(w -> w.length() > 2 && !w.chars().allMatch(Character::isDigit))
                .findFirst().orElse("");
    }
}
