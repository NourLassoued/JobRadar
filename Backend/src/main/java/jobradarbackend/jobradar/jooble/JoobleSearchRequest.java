package jobradarbackend.jobradar.jooble;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Corps JSON envoyé à POST https://jooble.org/api/{clé}.
 * Les champs null ne sont pas envoyés.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record JoobleSearchRequest(
        String keywords,
        String location,
        /** Rayon autour du lieu, en km */
        String radius,
        /** Salaire minimum */
        String salary,
        String page,
        @JsonProperty("ResultOnPage") String resultOnPage,
        /** "true" : chercher les mots-clés dans le nom de l'entreprise */
        @JsonProperty("companysearch") String companySearch
) {}