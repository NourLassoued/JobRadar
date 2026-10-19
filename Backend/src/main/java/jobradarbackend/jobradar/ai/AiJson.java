package jobradarbackend.jobradar.ai;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;


public final class AiJson {

    private static final ObjectMapper MAPPER = new ObjectMapper()
            .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

    private AiJson() {
    }

    public static <T> T parse(String content, Class<T> type) {
        String json = extractObject(content);
        try {
            return MAPPER.readValue(json, type);
        } catch (Exception e) {
            throw new AiException(AiException.Reason.BAD_RESPONSE,
                    "La réponse de l'IA n'est pas dans le format attendu. Réessayez.", e);
        }
    }

    /** Du premier « { » au dernier « } » */
    static String extractObject(String content) {
        if (content == null) {
            throw new AiException(AiException.Reason.BAD_RESPONSE, "Réponse vide de l'IA.");
        }
        int start = content.indexOf('{');
        int end = content.lastIndexOf('}');
        if (start < 0 || end <= start) {
            throw new AiException(AiException.Reason.BAD_RESPONSE, "La réponse de l'IA ne contient pas de JSON.");
        }
        return content.substring(start, end + 1);
    }

    /** Coupe un texte trop long pour ne pas dépasser la limite de l'IA */
    public static String truncate(String text, int maxChars) {
        if (text == null) return "";
        String t = text.strip();
        return t.length() <= maxChars ? t : t.substring(0, maxChars) + "\n[…texte tronqué…]";
    }
}