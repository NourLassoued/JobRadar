package jobradarbackend.jobradar.francetravail;

import jobradarbackend.jobradar.candidate.SectorType;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;


@RestController
@RequestMapping("/api/francetravail")
@RequiredArgsConstructor
public class FranceTravailController {

    private final FranceTravailImportService importService;


    @GetMapping("/sectors")
    public ResponseEntity<List<Map<String, Object>>> listSectors() {
        List<Map<String, Object>> sectors = Arrays.stream(SectorType.values())
                .map(s -> {
                    Map<String, Object> map = new HashMap<>();
                    map.put("name", s.name());
                    map.put("displayName", s.getDisplayName());
                    map.put("searchKeyword", s.getSearchKeyword());
                    map.put("importable", s.isImportable());
                    return map;
                })
                .toList();
        return ResponseEntity.ok(sectors);
    }


    @PostMapping("/import")
    public ResponseEntity<Map<String, Object>> importOffers(
            @RequestParam(required = false) String motsCles,
            @RequestParam(required = false) String commune,
            @RequestParam(defaultValue = "20") Integer max) {

        int imported = importService.importOffers(motsCles, commune, max);

        return ResponseEntity.ok(Map.of(
                "status", "success",
                "imported", imported,
                "motsCles", motsCles != null ? motsCles : "tous",
                "max", max
        ));
    }

    @PostMapping("/import/sector/{sector}")
    public ResponseEntity<Map<String, Object>> importBySector(@PathVariable SectorType sector) {

        if (!sector.isImportable()) {
            return ResponseEntity.badRequest().body(Map.of(
                    "status", "error",
                    "message", "Ce secteur n'est pas importable"
            ));
        }

        int imported = importService.importOffers(sector.getSearchKeyword(), null, 30);

        return ResponseEntity.ok(Map.of(
                "status", "success",
                "sector", sector.name(),
                "displayName", sector.getDisplayName(),
                "searchKeyword", sector.getSearchKeyword(),
                "imported", imported
        ));
    }

    /**
     * POST /api/francetravail/import/all
     * Lance manuellement l'import de TOUS les secteurs.
     */
    @PostMapping("/import/all")
    public ResponseEntity<Map<String, Object>> importAll() {
        int totalImported = 0;
        int sectorsOk = 0;
        int sectorsErr = 0;

        for (SectorType sector : SectorType.values()) {
            if (!sector.isImportable()) continue;

            try {
                int count = importService.importOffers(sector.getSearchKeyword(), null, 30);
                totalImported += count;
                sectorsOk++;
                Thread.sleep(1000);
            } catch (Exception e) {
                sectorsErr++;
            }
        }

        return ResponseEntity.ok(Map.of(
                "status", "success",
                "totalImported", totalImported,
                "sectorsOk", sectorsOk,
                "sectorsErr", sectorsErr
        ));
    }
}