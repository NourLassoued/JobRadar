package jobradarbackend.jobradar.candidate;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.*;


@RestController
@RequestMapping("/api/sectors")
public class SectorSkillsController {

    private final SectorSkillsCatalog catalog;

    public SectorSkillsController(SectorSkillsCatalog catalog) {
        this.catalog = catalog;
    }

    /** Un secteur avec son libellé et son nombre de compétences */
    public record SectorInfo(String code, String label, int skillCount) {}

    /** Résultat de la validation d'une liste de compétences */
    public record ValidationResult(String sector, boolean valid, List<String> unknownSkills,
                                   int validCount, int totalSectorSkills) {}

    /** GET /api/sectors — les secteurs de l'enum, avec libellé */
    @GetMapping
    public List<SectorInfo> getSectors() {
        return Arrays.stream(SectorType.values())
                .map(s -> new SectorInfo(s.name(), s.getDisplayName(), catalog.skillsFor(s).size()))
                .toList();
    }

    /** GET /api/sectors/TECH/skills — compétences d'un secteur */
    @GetMapping("/{sector}/skills")
    public List<String> getSectorSkills(@PathVariable String sector) {
        return catalog.skillsFor(parse(sector));
    }

    /** GET /api/sectors/skills — toutes les compétences, par secteur */
    @GetMapping("/skills")
    public Map<SectorType, List<String>> getAllSectorSkills() {
        return catalog.all();
    }

    /**
     * POST /api/sectors/TECH/skills/validate — indique quelles compétences
     * ne font pas partie du secteur (les compétences personnalisées restent autorisées).
     */
    @PostMapping("/{sector}/skills/validate")
    public ValidationResult validateSectorSkills(@PathVariable String sector,
                                                 @RequestBody List<String> skills) {
        SectorType type = parse(sector);
        List<String> unknown = skills.stream()
                .filter(Objects::nonNull)
                .filter(s -> !catalog.contains(type, s))
                .toList();

        return new ValidationResult(type.name(), unknown.isEmpty(), unknown,
                skills.size() - unknown.size(), catalog.skillsFor(type).size());
    }

    /** GET /api/sectors/count — statistiques */
    @GetMapping("/count")
    public Map<String, Object> getStatistics() {
        int totalSkills = catalog.all().values().stream().mapToInt(List::size).sum();
        return Map.of(
                "totalSectors", SectorType.values().length,
                "totalSkills", totalSkills);
    }

    /** « tech », « TECH » → SectorType.TECH ; code inconnu → 400 avec un message clair */
    private SectorType parse(String sector) {
        try {
            return SectorType.valueOf(sector.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Secteur inconnu : " + sector + ". Valeurs possibles : " + Arrays.toString(SectorType.values()));
        }
    }
}