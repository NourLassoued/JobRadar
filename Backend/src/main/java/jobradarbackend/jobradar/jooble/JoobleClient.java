package jobradarbackend.jobradar.jooble;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.util.List;

/**
 * Client HTTP Jooble. Seule classe qui connaît la clé.
 * La clé est dans l'URL : on ne journalise jamais l'URL complète.
 */
@Slf4j
@Component
public class JoobleClient {

    private final JoobleProperties props;
    private final RestClient restClient;

    public JoobleClient(JoobleProperties props) {
        this.props = props;

        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(props.getConnectTimeoutMs());
        factory.setReadTimeout(props.getReadTimeoutMs());

        this.restClient = RestClient.builder()
                .baseUrl(props.getBaseUrl())
                .requestFactory(factory)
                .build();
    }

    /**
     * Recherche une page d'offres.
     *
     * @param keywords mots-clés (ex. « infirmier »)
     * @param location lieu (ex. « Orléans », « France ») ; null = lieu par défaut
     * @param page     numéro de page, à partir de 1
     * @return la réponse, jamais null (liste vide si aucun résultat)
     */
    public JoobleSearchResponse search(String keywords, String location, int page, Integer resultsPerPage) {
        if (!props.isConfigured()) {
            throw new JoobleException(JoobleException.Reason.NOT_CONFIGURED,
                    "Jooble n'est pas configuré (jooble.api-key manquant).");
        }

        String where = hasText(location) ? location.trim() : props.getDefaultLocation();
        int safePage = Math.max(1, page);
        int perPage = resultsPerPage == null ? props.getResultsPerPage() : Math.min(50, Math.max(1, resultsPerPage));

        JoobleSearchRequest body = new JoobleSearchRequest(
                hasText(keywords) ? keywords.trim() : "",
                where,
                null,
                null,
                String.valueOf(safePage),
                String.valueOf(perPage),
                null);

        log.info("Jooble : recherche keywords='{}' location='{}' page={} ({} par page)", body.keywords(), where, safePage, perPage);

        try {
            JoobleSearchResponse response = restClient.post()
                    .uri("/{key}", props.getApiKey())
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .onStatus(HttpStatusCode::isError, (request, res) -> {
                        throw toException(res.getStatusCode().value());
                    })
                    .body(JoobleSearchResponse.class);

            if (response == null || response.jobs() == null) {
                log.info("Jooble : réponse vide");
                return new JoobleSearchResponse(0L, List.of());
            }

            log.info("Jooble : {} offres reçues (total annoncé : {})", response.jobs().size(), response.totalCount());
            return response;

        } catch (JoobleException e) {
            throw e;
        } catch (ResourceAccessException e) {
            log.warn("Jooble injoignable : {}", e.getMessage());
            throw new JoobleException(JoobleException.Reason.UNAVAILABLE, "Jooble ne répond pas.", e);
        } catch (RestClientResponseException e) {
            throw toException(e.getStatusCode().value());
        }
    }

    private JoobleException toException(int status) {
        log.warn("Jooble a répondu HTTP {}", status);
        return switch (status) {
            case 400 -> new JoobleException(JoobleException.Reason.BAD_REQUEST, "Requête refusée par Jooble.");
            case 401, 403 -> new JoobleException(JoobleException.Reason.INVALID_CREDENTIALS, "Clé Jooble refusée.");
            case 429 -> new JoobleException(JoobleException.Reason.RATE_LIMITED, "Quota d'appels Jooble dépassé.");
            default -> new JoobleException(JoobleException.Reason.UNAVAILABLE, "Jooble est temporairement indisponible (HTTP " + status + ").");
        };
    }

    private static boolean hasText(String s) {
        return s != null && !s.isBlank();
    }
}