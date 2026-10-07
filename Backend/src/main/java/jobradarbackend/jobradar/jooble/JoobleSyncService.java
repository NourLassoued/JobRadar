package jobradarbackend.jobradar.jooble;

import jobradarbackend.jobradar.candidate.SectorType;
import jobradarbackend.jobradar.joboffer.JobOffer;
import jobradarbackend.jobradar.joboffer.JobOfferRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Recherche Jooble + import dans job_offers, avec le même dédoublonnage
 * que France Travail et Adzuna : findByExternalId() → mise à jour, sinon création.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class JoobleSyncService {

    private final JoobleClient client;
    private final JoobleMapper mapper;
    private final JoobleProperties props;
    private final JobOfferRepository jobOfferRepository;

    /** Résultat d'une recherche : offres importées (avec leur id) + total annoncé par Jooble */
    public record SearchResult(long count, int page, List<JobOffer> offers) {}

    @Transactional
    public SearchResult searchAndImport(String keywords, String location, int page,
                                        Integer resultsPerPage, SectorType sector) {
        // Sans mot-clé, on utilise celui du secteur (« infirmier », « informatique »…)
        String query = keywords;
        if ((query == null || query.isBlank()) && sector != null && sector.getSearchKeyword() != null) {
            query = sector.getSearchKeyword();
        }

        JoobleSearchResponse response = client.search(query, location, page, resultsPerPage);
        List<JobOffer> saved = upsertAll(response.jobs(), sector);
        long count = response.totalCount() == null ? saved.size() : response.totalCount();
        return new SearchResult(count, Math.max(1, page), saved);
    }

    @Transactional
    public int syncSector(String location, SectorType sector, int pages) {
        if (sector.getSearchKeyword() == null) return 0;

        int imported = 0;
        for (int page = 1; page <= pages; page++) {
            JoobleSearchResponse response = client.search(sector.getSearchKeyword(), location, page, 50);
            if (response.jobs().isEmpty()) break;
            imported += upsertAll(response.jobs(), sector).size();
        }
        log.info("Jooble [{}] : {} offres synchronisées pour {}", location, imported, sector);
        return imported;
    }

    /** Synchronise les lieux de jooble.sync.locations ; renvoie le nombre d'offres par lieu */
    public Map<String, Integer> syncAll() {
        Map<String, Integer> byLocation = new LinkedHashMap<>();
        if (!props.isConfigured()) {
            log.warn("Synchronisation Jooble ignorée : clé non configurée");
            return byLocation;
        }

        locations:
        for (String location : props.getSync().getLocations()) {
            int total = 0;
            for (SectorType sector : SectorType.values()) {
                if (!sector.isImportable()) continue;
                try {
                    total += syncSector(location, sector, props.getSync().getPagesPerSector());
                } catch (JoobleException e) {
                    log.warn("Jooble [{}] : synchronisation de {} interrompue ({})", location, sector, e.getMessage());
                    if (e.getReason() == JoobleException.Reason.RATE_LIMITED
                            || e.getReason() == JoobleException.Reason.INVALID_CREDENTIALS) {
                        byLocation.put(location, total);
                        break locations;
                    }
                }
            }
            byLocation.put(location, total);
        }
        log.info("Jooble : synchronisation terminée {}", byLocation);
        return byLocation;
    }

    /** Tâche nocturne, active seulement si jooble.sync.enabled=true */
    @Scheduled(cron = "${jooble.sync.cron:0 0 4 * * *}")
    public void scheduledSync() {
        if (!props.getSync().isEnabled()) return;
        log.info("Jooble : démarrage de la synchronisation planifiée");
        syncAll();
    }

    private List<JobOffer> upsertAll(List<JoobleSearchResponse.Job> jobs, SectorType fallbackSector) {
        List<JobOffer> result = new ArrayList<>();
        for (JoobleSearchResponse.Job job : jobs) {
            if (job == null || job.id() == null || job.title() == null) continue;

            JobOffer offer = jobOfferRepository.findByExternalId(mapper.externalId(job.id()))
                    .orElseGet(JobOffer::new);
            mapper.toJobOffer(job, offer, fallbackSector);
            result.add(jobOfferRepository.save(offer));
        }
        return result;
    }
}