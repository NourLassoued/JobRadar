package jobradarbackend.jobradar.adzuna;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.util.List;


@Slf4j
@Component
public class AdzunaClient {

    private final AdzunaProperties props;
    private final RestClient restClient;

    public AdzunaClient(AdzunaProperties props) {
        this.props = props;

        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(props.getConnectTimeoutMs());
        factory.setReadTimeout(props.getReadTimeoutMs());

        this.restClient = RestClient.builder()
                .baseUrl(props.getBaseUrl())
                .requestFactory(factory)
                .build();
    }

    public AdzunaSearchResponse search(String country, String what, String where, int page, Integer resultsPerPage) {
        if (!props.isConfigured()) {
            throw new AdzunaException(AdzunaException.Reason.NOT_CONFIGURED,
                    "Adzuna n'est pas configuré (ADZUNA_APP_ID / ADZUNA_APP_KEY manquants).");
        }

        String code = props.resolveCountry(country);
        if (code == null) {
            throw new AdzunaException(AdzunaException.Reason.UNSUPPORTED_COUNTRY,
                    "Pays non pris en charge : " + country + ". Pays possibles : " + props.getCountries());
        }

        int safePage = Math.max(1, page);
        int perPage = resultsPerPage == null ? props.getResultsPerPage() : Math.min(50, Math.max(1, resultsPerPage));

        log.info("Adzuna [{}] : recherche what='{}' where='{}' page={} ({} par page)", code, what, where, safePage, perPage);

        try {
            AdzunaSearchResponse response = restClient.get()
                    .uri(uri -> {
                        uri.path("/jobs/{country}/search/{page}")
                                .queryParam("app_id", props.getAppId())
                                .queryParam("app_key", props.getAppKey())
                                .queryParam("results_per_page", perPage)
                                .queryParam("content-type", "application/json");
                        if (hasText(what)) uri.queryParam("what", what.trim());
                        if (hasText(where)) uri.queryParam("where", where.trim());
                        return uri.build(code, safePage);
                    })
                    .retrieve()
                    .onStatus(HttpStatusCode::isError, (request, res) -> {
                        throw toException(res.getStatusCode().value());
                    })
                    .body(AdzunaSearchResponse.class);

            if (response == null || response.results() == null) {
                log.info("Adzuna [{}] : réponse vide", code);
                return new AdzunaSearchResponse(0L, List.of());
            }

            log.info("Adzuna [{}] : {} offres reçues (total annoncé : {})", code, response.results().size(), response.count());
            return response;

        } catch (AdzunaException e) {
            throw e;
        } catch (ResourceAccessException e) {
            log.warn("Adzuna injoignable : {}", e.getMessage());
            throw new AdzunaException(AdzunaException.Reason.UNAVAILABLE, "Adzuna ne répond pas.", e);
        } catch (RestClientResponseException e) {
            throw toException(e.getStatusCode().value());
        }
    }

    private AdzunaException toException(int status) {
        log.warn("Adzuna a répondu HTTP {}", status);
        return switch (status) {
            case 400 -> new AdzunaException(AdzunaException.Reason.BAD_REQUEST, "Paramètres de recherche refusés par Adzuna.");
            case 401, 403 -> new AdzunaException(AdzunaException.Reason.INVALID_CREDENTIALS, "Clés Adzuna refusées.");
            case 429 -> new AdzunaException(AdzunaException.Reason.RATE_LIMITED, "Quota d'appels Adzuna dépassé.");
            default -> new AdzunaException(AdzunaException.Reason.UNAVAILABLE, "Adzuna est temporairement indisponible (HTTP " + status + ").");
        };
    }

    private static boolean hasText(String s) {
        return s != null && !s.isBlank();
    }
}