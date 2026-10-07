package jobradarbackend.jobradar.jooble;

import jobradarbackend.jobradar.candidate.SectorType;
import jobradarbackend.jobradar.joboffer.ContractType;
import jobradarbackend.jobradar.joboffer.JobOffer;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeParseException;
import java.util.Locale;

/**
 * Convertit une offre Jooble en JobOffer existant (mêmes champs que pour Adzuna et France Travail).
 */
@Component
public class JoobleMapper {

    public static final String SOURCE = "JOOBLE";
    private static final String EXTERNAL_ID_PREFIX = "JOOBLE-";

    /**
     * @param target         offre existante (mise à jour) ou nouvelle instance
     * @param fallbackSector secteur de la recherche : Jooble ne fournit pas de catégorie
     */
    public JobOffer toJobOffer(JoobleSearchResponse.Job job, JobOffer target, SectorType fallbackSector) {
        target.setExternalId(externalId(job.id()));
        target.setSource(SOURCE);

        target.setTitle(truncate(stripHtml(job.title()), 255));
        target.setDescription(stripHtml(job.snippet()));
        target.setCompany(blankToNull(job.company()));
        target.setLocation(blankToNull(job.location()));
        target.setUrl(job.link());

        target.setSector((fallbackSector != null ? fallbackSector : SectorType.OTHER).name());
        target.setContractType(toContractTypeEnum(job.type()));
        target.setRemote(isRemote(job));

        // Salaire Jooble en texte libre (devise et période variables) : non enregistré
        // pour ne pas afficher un montant faux. Le texte reste lisible sur l'annonce d'origine.
        target.setSalaryMin(null);
        target.setSalaryMax(null);

        target.setIsActive(true);

        // Date de mise à jour Jooble. Si createdAt est géré par @CreationTimestamp,
        // supprime cette ligne (ou utilise un champ publishedAt).
        LocalDateTime updated = parseDate(job.updated());
        if (updated != null) target.setCreatedAt(updated);

        return target;
    }

    public String externalId(String joobleId) {
        return EXTERNAL_ID_PREFIX + joobleId;
    }

    // ── Normalisation ──────────────────────────────────────────

    /** Type Jooble en texte libre → enum ContractType du projet ; null si inconnu */
    private ContractType toContractTypeEnum(String type) {
        String t = type == null ? "" : type.toLowerCase(Locale.ROOT);
        String wanted = null;
        if (t.contains("cdi") || t.contains("permanent")) wanted = "CDI";
        else if (t.contains("cdd") || t.contains("temporary") || t.contains("contract") || t.contains("intérim") || t.contains("interim")) wanted = "CDD";
        if (wanted == null) return null;

        for (ContractType value : ContractType.values()) {
            if (value.name().equalsIgnoreCase(wanted)) return value;
        }
        return null;
    }

    private boolean isRemote(JoobleSearchResponse.Job job) {
        String text = String.join(" ",
                job.title() == null ? "" : job.title(),
                job.snippet() == null ? "" : job.snippet(),
                job.location() == null ? "" : job.location(),
                job.type() == null ? "" : job.type()).toLowerCase(Locale.ROOT);
        return text.contains("télétravail") || text.contains("teletravail")
                || text.contains("remote") || text.contains("à distance");
    }

    /** « 2026-10-06T00:00:00.0000000 » ou « 2026-10-06 » → LocalDateTime */
    private LocalDateTime parseDate(String value) {
        if (value == null || value.isBlank()) return null;
        String v = value.trim();
        try {
            return LocalDateTime.parse(v);
        } catch (DateTimeParseException ignored) {
            // format sans heure
        }
        try {
            return LocalDate.parse(v.length() >= 10 ? v.substring(0, 10) : v).atStartOfDay();
        } catch (DateTimeParseException e) {
            return null;
        }
    }

    /** Jooble met les mots trouvés en <b> et ajoute des entités HTML */
    private String stripHtml(String text) {
        if (text == null) return null;
        return text.replaceAll("<[^>]+>", "")
                .replace("&amp;", "&").replace("&quot;", "\"").replace("&#39;", "'")
                .replace("&lt;", "<").replace("&gt;", ">").replace("&nbsp;", " ")
                .replaceAll("\\s+", " ")
                .trim();
    }

    private String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }

    private String truncate(String text, int max) {
        return text == null || text.length() <= max ? text : text.substring(0, max - 1) + "…";
    }
}