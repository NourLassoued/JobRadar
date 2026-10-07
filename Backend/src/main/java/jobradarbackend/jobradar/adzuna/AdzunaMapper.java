package jobradarbackend.jobradar.adzuna;

import jobradarbackend.jobradar.candidate.SectorType;
import jobradarbackend.jobradar.joboffer.ContractType;
import jobradarbackend.jobradar.joboffer.JobOffer;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import java.util.Locale;
import java.util.Map;

/**
 * Convertit une offre Adzuna en JobOffer existant.
 *
 * ⚠ Seul endroit à adapter si un nom ou un type de champ de ton JobOffer diffère
 *   (ex. salaire en Double au lieu de BigDecimal, secteur en enum au lieu de String),
 *   ou si JobOffer n'est pas dans le package jobradarbackend.jobradar.joboffer.
 */
@Component
@RequiredArgsConstructor
public class AdzunaMapper {

    public static final String SOURCE = "ADZUNA";
    private static final String EXTERNAL_ID_PREFIX = "ADZUNA-";

    private final AdzunaProperties props;

    /** Catégories Adzuna (tag, identique dans tous les pays) → code SectorType */
    private static final Map<String, SectorType> CATEGORY_TO_SECTOR = Map.ofEntries(
            Map.entry("it-jobs", SectorType.TECH),
            Map.entry("healthcare-nursing-jobs", SectorType.HEALTH),
            Map.entry("sales-jobs", SectorType.COMMERCE),
            Map.entry("retail-jobs", SectorType.COMMERCE),
            Map.entry("customer-services-jobs", SectorType.COMMERCE),
            Map.entry("trade-construction-jobs", SectorType.BTP),
            Map.entry("property-jobs", SectorType.BTP),
            Map.entry("hospitality-catering-jobs", SectorType.HOSPITALITY),
            Map.entry("travel-jobs", SectorType.HOSPITALITY),
            Map.entry("logistics-warehouse-jobs", SectorType.TRANSPORT),
            Map.entry("manufacturing-jobs", SectorType.INDUSTRY),
            Map.entry("engineering-jobs", SectorType.INDUSTRY),
            Map.entry("energy-oil-gas-jobs", SectorType.INDUSTRY),
            Map.entry("pr-advertising-marketing-jobs", SectorType.COMMUNICATION),
            Map.entry("accounting-finance-jobs", SectorType.BANKING),
            Map.entry("teaching-jobs", SectorType.EDUCATION),
            Map.entry("graduate-jobs", SectorType.EDUCATION),
            Map.entry("creative-design-jobs", SectorType.ARTS),
            Map.entry("social-work-jobs", SectorType.PERSONAL_SERVICES),
            Map.entry("domestic-help-cleaning-jobs", SectorType.PERSONAL_SERVICES),
            Map.entry("maintenance-jobs", SectorType.MAINTENANCE)
    );

    /**
     * Crée ou met à jour un JobOffer à partir d'une offre Adzuna.
     *
     * @param country        pays de la recherche (fr, gb…)
     * @param target         offre existante (mise à jour) ou nouvelle instance
     * @param fallbackSector secteur utilisé si la catégorie Adzuna est inconnue
     */
    public JobOffer toJobOffer(AdzunaSearchResponse.Job job, String country, JobOffer target, SectorType fallbackSector) {
        target.setExternalId(externalId(country, job.id()));
        target.setSource(SOURCE);

        target.setTitle(truncate(stripHtml(job.title()), 255));
        target.setDescription(stripHtml(job.description()));
        target.setCompany(job.company() != null ? job.company().displayName() : null);
        target.setLocation(location(job, country));
        target.setUrl(job.redirectUrl());

        // Secteur stocké sous forme de nom d'enum (« TECH »), comme pour France Travail
        target.setSector(resolveSector(job, fallbackSector).name());
        target.setContractType(toContractTypeEnum(job));        // Salaires enregistrés seulement en euros : le frontend les affiche avec « € »
        if (props.isEuroCountry(country)) {
            target.setSalaryMin(toMoney(job.salaryMin()));
            target.setSalaryMax(toMoney(job.salaryMax()));
        } else {
            target.setSalaryMin(null);
            target.setSalaryMax(null);
        }

        target.setIsActive(true);

        // Date de publication. Si createdAt est géré par @CreationTimestamp
        // dans ton entité, supprime cette ligne (Hibernate écrasera la valeur).
        LocalDateTime published = parseDate(job.created());
        if (published != null) target.setCreatedAt(published);

        return target;
    }

    /** ADZUNA-FR-12345 : le pays évite les collisions d'identifiants entre pays */
    public String externalId(String country, String adzunaId) {
        return EXTERNAL_ID_PREFIX + country.toUpperCase(Locale.ROOT) + "-" + adzunaId;
    }

    // ── Normalisation ──────────────────────────────────────────

    /** Lieu Adzuna ; hors France on ajoute le pays pour éviter les confusions (« London, GB ») */
    private String location(AdzunaSearchResponse.Job job, String country) {
        String name = job.location() != null ? job.location().displayName() : null;
        if ("fr".equalsIgnoreCase(country)) return name;
        String suffix = country.toUpperCase(Locale.ROOT);
        return name == null || name.isBlank() ? suffix : name + ", " + suffix;
    }

    private SectorType resolveSector(AdzunaSearchResponse.Job job, SectorType fallback) {
        String tag = job.category() != null ? job.category().tag() : null;
        if (tag != null) {
            SectorType mapped = CATEGORY_TO_SECTOR.get(tag.toLowerCase(Locale.ROOT));
            if (mapped != null) return mapped;
        }
        return fallback != null ? fallback : SectorType.OTHER;
    }

    /** Adzuna : permanent → CDI, contract → CDD ; le temps partiel est précisé */
    /** Adzuna (permanent / contract) → enum ContractType du projet ; null si inconnu */
    private ContractType toContractTypeEnum(AdzunaSearchResponse.Job job) {
        String type = job.contractType() == null ? "" : job.contractType().toLowerCase(Locale.ROOT);
        String wanted = switch (type) {
            case "permanent" -> "CDI";
            case "contract" -> "CDD";
            default -> null;
        };
        if (wanted == null) return null;

        for (ContractType value : ContractType.values()) {
            if (value.name().equalsIgnoreCase(wanted)) return value;
        }
        return null;
    }

    private boolean isRemote(AdzunaSearchResponse.Job job) {
        String text = ((job.title() == null ? "" : job.title()) + " " + (job.description() == null ? "" : job.description()))
                .toLowerCase(Locale.ROOT);
        return text.contains("télétravail") || text.contains("teletravail")
                || text.contains("remote") || text.contains("home office") || text.contains("homeoffice");
    }

    /** Arrondi à l'unité ; null si absent ou nul */
    private BigDecimal toMoney(Double value) {
        if (value == null || value <= 0) return null;
        return BigDecimal.valueOf(value).setScale(0, RoundingMode.HALF_UP);
    }

    /** Date ISO convertie à l'heure de Paris (fuseau d'affichage de JobRadar) */
    private LocalDateTime parseDate(String iso) {
        if (iso == null || iso.isBlank()) return null;
        try {
            return OffsetDateTime.parse(iso).atZoneSameInstant(ZoneId.of("Europe/Paris")).toLocalDateTime();
        } catch (DateTimeParseException e) {
            return null;
        }
    }

    /** Adzuna entoure les mots trouvés de <strong> : on retire tout le HTML */
    private String stripHtml(String text) {
        if (text == null) return null;
        return text.replaceAll("<[^>]+>", "")
                .replace("&amp;", "&").replace("&quot;", "\"").replace("&#39;", "'")
                .replace("&lt;", "<").replace("&gt;", ">").replace("&nbsp;", " ")
                .replaceAll("\\s+", " ")
                .trim();
    }

    private String truncate(String text, int max) {
        return text == null || text.length() <= max ? text : text.substring(0, max - 1) + "…";
    }
}