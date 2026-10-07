package jobradarbackend.jobradar.adzuna;

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


@Slf4j
@Service
@RequiredArgsConstructor
public class AdzunaSyncService {

    private final AdzunaClient client;
    private final AdzunaMapper mapper;
    private final AdzunaProperties props;
    private final JobOfferRepository jobOfferRepository;

    /** Résultat d'une recherche : offres importées (avec leur id) + total annoncé par Adzuna */
    public record SearchResult(String country, long count, int page, List<JobOffer> offers) {}

    /**
     * Recherche dans un pays et enregistre les offres trouvées.
     * Elles reçoivent un id et apparaissent ensuite dans les autres endpoints.
     */
    @Transactional
    public SearchResult searchAndImport(String country, String what, String where, int page,
                                        Integer resultsPerPage, SectorType sector) {
        String code = requireCountry(country);

        // Sans mot-clé, on utilise celui du secteur (en français : surtout pertinent pour la France)
        String keyword = what;
        if ((keyword == null || keyword.isBlank()) && sector != null && sector.getSearchKeyword() != null) {
            keyword = sector.getSearchKeyword();
        }

        AdzunaSearchResponse response = client.search(code, keyword, where, page, resultsPerPage);
        List<JobOffer> saved = upsertAll(response.results(), code, sector);
        long count = response.count() == null ? saved.size() : response.count();
        return new SearchResult(code, count, Math.max(1, page), saved);
    }

    /** Import d'un secteur dans un pays, sur plusieurs pages */
    @Transactional
    public int syncSector(String country, SectorType sector, int pages) {
        if (sector.getSearchKeyword() == null) return 0;
        String code = requireCountry(country);

        int imported = 0;
        for (int page = 1; page <= pages; page++) {
            AdzunaSearchResponse response = client.search(code, sector.getSearchKeyword(), null, page, 50);
            if (response.results().isEmpty()) break;
            imported += upsertAll(response.results(), code, sector).size();
        }
        log.info("Adzuna [{}] : {} offres synchronisées pour {}", code, imported, sector);
        return imported;
    }

    /**
     * Synchronise les pays de adzuna.sync.countries (pas toute la liste adzuna.countries,
     * pour protéger le quota). Renvoie le nombre d'offres importées par pays.
     */
    public Map<String, Integer> syncAll() {
        Map<String, Integer> byCountry = new LinkedHashMap<>();
        if (!props.isConfigured()) {
            log.warn("Synchronisation Adzuna ignorée : clés non configurées");
            return byCountry;
        }

        countries:
        for (String country : props.getSync().getCountries()) {
            String code = props.resolveCountry(country);
            if (code == null) {
                log.warn("Adzuna : pays de synchronisation ignoré (absent de adzuna.countries) : {}", country);
                continue;
            }

            int total = 0;
            for (SectorType sector : SectorType.values()) {
                if (!sector.isImportable()) continue;
                try {
                    total += syncSector(code, sector, props.getSync().getPagesPerSector());
                } catch (AdzunaException e) {
                    log.warn("Adzuna [{}] : synchronisation de {} interrompue ({})", code, sector, e.getMessage());
                    // Quota dépassé ou clés refusées : inutile de continuer
                    if (e.getReason() == AdzunaException.Reason.RATE_LIMITED
                            || e.getReason() == AdzunaException.Reason.INVALID_CREDENTIALS) {
                        byCountry.put(code, total);
                        break countries;
                    }
                }
            }
            byCountry.put(code, total);
        }
        log.info("Adzuna : synchronisation terminée {}", byCountry);
        return byCountry;
    }

    /** Tâche nocturne, active seulement si adzuna.sync.enabled=true */
    @Scheduled(cron = "${adzuna.sync.cron:0 0 3 * * *}")
    public void scheduledSync() {
        if (!props.getSync().isEnabled()) return;
        log.info("Adzuna : démarrage de la synchronisation planifiée");
        syncAll();
    }

    // ── Utilitaires ────────────────────────────────────────────

    private String requireCountry(String country) {
        String code = props.resolveCountry(country);
        if (code == null) {
            throw new AdzunaException(AdzunaException.Reason.UNSUPPORTED_COUNTRY,
                    "Pays non pris en charge : " + country);
        }
        return code;
    }

    private List<JobOffer> upsertAll(List<AdzunaSearchResponse.Job> jobs, String country, SectorType fallbackSector) {
        List<JobOffer> result = new ArrayList<>();
        for (AdzunaSearchResponse.Job job : jobs) {
            if (job == null || job.id() == null || job.title() == null) continue;

            JobOffer offer = jobOfferRepository.findByExternalId(mapper.externalId(country, job.id()))
                    .orElseGet(JobOffer::new);
            mapper.toJobOffer(job, country, offer, fallbackSector);
            result.add(jobOfferRepository.save(offer));
        }
        return result;
    }
}