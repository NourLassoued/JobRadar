package jobradarbackend.jobradar.jooble;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public record JoobleSearchResponse(
        Long totalCount,
        List<Job> jobs
) {

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Job(
            /** Identifiant Jooble (nombre très long : lu en texte) */
            String id,
            String title,
            String location,
            /** Extrait de l'annonce, peut contenir du HTML */
            String snippet,
            /** Salaire en texte libre, ex. « 35 000 € par an » */
            String salary,
            /** Site d'origine de l'annonce (ex. indeed.fr) */
            String source,
            /** Type de contrat en texte libre (CDI, Full-time…) */
            String type,
            /** Lien vers l'annonce */
            String link,
            String company,
            /** Date de mise à jour, ex. 2026-10-06T00:00:00.0000000 */
            String updated
    ) {}
}