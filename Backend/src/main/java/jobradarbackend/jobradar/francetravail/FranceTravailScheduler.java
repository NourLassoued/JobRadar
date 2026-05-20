package jobradarbackend.jobradar.francetravail;

import jobradarbackend.jobradar.candidate.SectorType;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.List;


@Slf4j
@Component
@RequiredArgsConstructor
public class FranceTravailScheduler {

    private final FranceTravailImportService importService;

    private static final int OFFERS_PER_SECTOR = 30;


    @Scheduled(cron = "0 0 */6 * * *")
    public void importAllSectors() {
        log.info(" ========== DÉBUT DE L'IMPORT AUTOMATIQUE ==========");

        int totalImported = 0;
        int sectorsProcessed = 0;
        int sectorsFailed = 0;

        List<SectorType> sectors = Arrays.stream(SectorType.values())
                .filter(SectorType::isImportable)
                .toList();

        log.info("{} secteurs à traiter", sectors.size());

        for (SectorType sector : sectors) {
            try {
                log.info("Import du secteur : {} (mot-clé : '{}')",
                        sector.name(), sector.getSearchKeyword());

                int count = importService.importOffers(
                        sector.getSearchKeyword(),
                        null,
                        OFFERS_PER_SECTOR
                );

                log.info("{} offres import\u00e9es pour le secteur {}", count, sector.name());
                totalImported += count;
                sectorsProcessed++;

                Thread.sleep(1000);

            } catch (InterruptedException e) {
                log.error("Import interrompu", e);
                Thread.currentThread().interrupt();
                break;

            } catch (Exception e) {
                log.error(" Erreur lors de l'import du secteur {} : {}",
                        sector.name(), e.getMessage());
                sectorsFailed++;
            }
        }

        log.info("========== IMPORT TERMINÉ ==========");
        log.info(" Bilan : {} offres importées | {} secteurs OK | {} secteurs en erreur",
                totalImported, sectorsProcessed, sectorsFailed);
    }
}