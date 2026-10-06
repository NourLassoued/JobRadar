package jobradarbackend.jobradar.candidate.language;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Arrays;
import java.util.List;

/** Référentiel des langues et des niveaux, utilisé par le formulaire du profil. */
@RestController
@RequestMapping("/api/languages")
public class LanguageController {

    private final LanguageCatalog catalog;

    public LanguageController(LanguageCatalog catalog) {
        this.catalog = catalog;
    }

    public record LanguageOption(String code, String label) {}
    public record LevelOption(String code, String shortLabel, String label, String description, int rank) {}
    public record LanguageReference(List<LanguageOption> languages, List<LevelOption> levels, int maxPerCandidate) {}

    /** GET /api/languages — langues proposées + niveaux CECRL */
    @GetMapping
    public LanguageReference getReference() {
        List<LanguageOption> languages = catalog.all().entrySet().stream()
                .map(e -> new LanguageOption(e.getKey(), e.getValue()))
                .toList();

        List<LevelOption> levels = Arrays.stream(LanguageLevel.values())
                .map(l -> new LevelOption(l.name(), l.getShortLabel(), l.getLabel(), l.getDescription(), l.getRank()))
                .toList();

        return new LanguageReference(languages, levels, LanguageCatalog.MAX_LANGUAGES);
    }
}