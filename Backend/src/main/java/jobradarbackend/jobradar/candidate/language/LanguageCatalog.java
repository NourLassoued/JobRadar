package jobradarbackend.jobradar.candidate.language;

import org.springframework.stereotype.Component;

import java.util.*;

@Component
public class LanguageCatalog {

    /** Nombre maximum de langues par candidat */
    public static final int MAX_LANGUAGES = 10;

    private static final Map<String, String> LANGUAGES = new LinkedHashMap<>();

    static {
        // Les plus demandées d'abord, puis l'ordre alphabétique
        LANGUAGES.put("fr", "Français");
        LANGUAGES.put("en", "Anglais");
        LANGUAGES.put("ar", "Arabe");
        LANGUAGES.put("es", "Espagnol");
        LANGUAGES.put("de", "Allemand");
        LANGUAGES.put("it", "Italien");
        LANGUAGES.put("pt", "Portugais");
        LANGUAGES.put("nl", "Néerlandais");
        LANGUAGES.put("zh", "Chinois (mandarin)");
        LANGUAGES.put("ru", "Russe");
        LANGUAGES.put("tr", "Turc");
        LANGUAGES.put("ber", "Berbère / Amazigh");
        LANGUAGES.put("bn", "Bengali");
        LANGUAGES.put("ko", "Coréen");
        LANGUAGES.put("da", "Danois");
        LANGUAGES.put("fi", "Finnois");
        LANGUAGES.put("el", "Grec");
        LANGUAGES.put("he", "Hébreu");
        LANGUAGES.put("hi", "Hindi");
        LANGUAGES.put("hu", "Hongrois");
        LANGUAGES.put("id", "Indonésien");
        LANGUAGES.put("ja", "Japonais");
        LANGUAGES.put("lsf", "Langue des signes française (LSF)");
        LANGUAGES.put("no", "Norvégien");
        LANGUAGES.put("ur", "Ourdou");
        LANGUAGES.put("fa", "Persan");
        LANGUAGES.put("pl", "Polonais");
        LANGUAGES.put("ro", "Roumain");
        LANGUAGES.put("sv", "Suédois");
        LANGUAGES.put("sw", "Swahili");
        LANGUAGES.put("cs", "Tchèque");
        LANGUAGES.put("th", "Thaï");
        LANGUAGES.put("uk", "Ukrainien");
        LANGUAGES.put("vi", "Vietnamien");
        LANGUAGES.put("wo", "Wolof");
    }

    public Map<String, String> all() {
        return Collections.unmodifiableMap(LANGUAGES);
    }

    public boolean isKnown(String code) {
        return code != null && LANGUAGES.containsKey(code.trim().toLowerCase(Locale.ROOT));
    }

    public String normalize(String code) {
        return code == null ? null : code.trim().toLowerCase(Locale.ROOT);
    }

    /**
     * Nettoie la liste reçue : codes inconnus retirés, doublons supprimés
     * (la première occurrence gagne), limite de MAX_LANGUAGES.
     */
    public List<CandidateLanguage> sanitize(List<LanguageDto> input) {
        if (input == null) return List.of();
        Map<String, CandidateLanguage> unique = new LinkedHashMap<>();
        for (LanguageDto dto : input) {
            if (dto == null || dto.level() == null || !isKnown(dto.code())) continue;
            String code = normalize(dto.code());
            unique.putIfAbsent(code, new CandidateLanguage(code, dto.level()));
            if (unique.size() == MAX_LANGUAGES) break;
        }
        return new ArrayList<>(unique.values());
    }
}