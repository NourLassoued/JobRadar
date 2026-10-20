package jobradarbackend.jobradar.ai.interview;

import jobradarbackend.jobradar.ai.interview.InterviewDtos.Category;
import jobradarbackend.jobradar.ai.interview.InterviewDtos.InterviewQuestion;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
public final class InterviewQuestionSanitizer {

    /** Ordre d'affichage : de la question d'ouverture aux points faibles */
    private static final List<Category> ORDER = List.of(
            Category.MOTIVATION, Category.EXPERIENCE, Category.TECHNICAL, Category.BEHAVIORAL, Category.GAP);

    private static final int MAX_KEY_POINTS = 4;

    private InterviewQuestionSanitizer() {
    }

    /** Question telle que renvoyée par l'IA (catégorie en texte libre) */
    public record RawQuestion(String category, String question, String why, String suggestedAnswer,
                              List<String> keyPoints, String relatedSkill) {}


    public static List<InterviewQuestion> sanitize(List<RawQuestion> raw, int max, List<String> missingSkills) {
        if (raw == null) return List.of();

        Set<String> missing = new HashSet<>();
        if (missingSkills != null) missingSkills.forEach(s -> missing.add(normalize(s)));

        Set<String> seen = new HashSet<>();
        List<InterviewQuestion> result = new ArrayList<>();
        for (RawQuestion q : raw) {
            if (q == null || isBlank(q.question())) continue;
            String question = q.question().strip();
            if (!seen.add(normalize(question))) continue; // doublon

            String skill = isBlank(q.relatedSkill()) ? null : q.relatedSkill().strip();
            Category category = parseCategory(q.category());
            // Garde-fou : une compétence absente du profil est toujours traitée comme un point à combler
            if (skill != null && missing.contains(normalize(skill))) category = Category.GAP;

            result.add(new InterviewQuestion(
                    category,
                    question,
                    clean(q.why()),
                    clean(q.suggestedAnswer()),
                    cleanList(q.keyPoints(), MAX_KEY_POINTS),
                    skill));
            if (result.size() == max) break;
        }

        result.sort(Comparator.comparingInt(q -> ORDER.indexOf(q.category())));
        return List.copyOf(result);
    }

    /** « technique », « Technical », « GAP »… → catégorie ; inconnue → EXPERIENCE */
    static Category parseCategory(String value) {
        String v = normalize(value);
        if (v.isEmpty()) return Category.EXPERIENCE;
        if (v.startsWith("tech")) return Category.TECHNICAL;
        if (v.startsWith("behav") || v.startsWith("comport") || v.startsWith("soft") || v.contains("situation")) return Category.BEHAVIORAL;
        if (v.startsWith("motiv")) return Category.MOTIVATION;
        if (v.startsWith("gap") || v.contains("faible") || v.contains("manqu") || v.contains("weak")) return Category.GAP;
        if (v.startsWith("exp") || v.contains("parcours") || v.contains("projet")) return Category.EXPERIENCE;
        return Category.EXPERIENCE;
    }

    /** Liste sans éléments vides, sans doublons, limitée à max éléments */
    public static List<String> cleanList(List<String> values, int max) {
        if (values == null) return List.of();
        Set<String> seen = new HashSet<>();
        return values.stream()
                .filter(Objects::nonNull)
                .map(String::strip)
                .filter(s -> !s.isEmpty())
                .filter(s -> seen.add(normalize(s)))
                .limit(max)
                .toList();
    }

    private static String clean(String value) {
        return isBlank(value) ? "" : value.strip();
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private static String normalize(String value) {
        if (value == null) return "";
        return Normalizer.normalize(value, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT)
                .replaceAll("\\s+", " ")
                .strip();
    }
}