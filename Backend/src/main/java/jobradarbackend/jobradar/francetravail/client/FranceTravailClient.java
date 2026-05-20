package jobradarbackend.jobradar.francetravail.client;

import jobradarbackend.jobradar.francetravail.FranceTravailAuthService;
import jobradarbackend.jobradar.francetravail.dtoFrancetrvail.FranceTravailOfferDto;
import jobradarbackend.jobradar.francetravail.dtoFrancetrvail.FranceTravailSearchResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;
import java.util.Collections;
import java.util.List;


@Slf4j
@Component
@RequiredArgsConstructor
public class FranceTravailClient {

    @Value("${francetravail.offers-url}")
    private String offersUrl;

    private final FranceTravailAuthService authService;
    private final RestTemplate restTemplate = new RestTemplate();

    public List<FranceTravailOfferDto> searchOffers(String motsCles, String commune, String range) {
        log.info("🔍 Recherche France Travail : motsCles={}, commune={}, range={}",
                motsCles, commune, range);

        String token = authService.getAccessToken();

        // Construire l'URL avec les paramètres
        UriComponentsBuilder builder = UriComponentsBuilder.fromUriString(offersUrl);

        if (motsCles != null && !motsCles.isEmpty()) {
            builder.queryParam("motsCles", motsCles);
        }
        if (commune != null && !commune.isEmpty()) {
            builder.queryParam("commune", commune);
        }
        if (range != null && !range.isEmpty()) {
            builder.queryParam("range", range);
        }

        URI uri = builder.build().toUri();

        // 👇 LOGS DEBUG IMPORTANTS
        log.info("🔍 [DEBUG] URL appelée : {}", uri);
        log.info("🔍 [DEBUG] Token (10 chars) : {}...", token.substring(0, Math.min(10, token.length())));

        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token);
        headers.setAccept(Collections.singletonList(MediaType.APPLICATION_JSON));

        HttpEntity<Void> entity = new HttpEntity<>(headers);

        try {
            // ⭐ TEST 1 : Récupérer la réponse en String pour voir le JSON BRUT
            ResponseEntity<String> rawResponse = restTemplate.exchange(
                    uri,
                    HttpMethod.GET,
                    entity,
                    String.class
            );

            log.info("🔍 [DEBUG] Status HTTP : {}", rawResponse.getStatusCode());
            log.info("🔍 [DEBUG] Body (200 premiers chars) : {}",
                    rawResponse.getBody() != null
                            ? rawResponse.getBody().substring(0, Math.min(200, rawResponse.getBody().length()))
                            : "null");

            // ⭐ TEST 2 : Maintenant essayer de parser en objet
            ResponseEntity<FranceTravailSearchResponse> response = restTemplate.exchange(
                    uri,
                    HttpMethod.GET,
                    entity,
                    FranceTravailSearchResponse.class
            );

            log.info("🔍 [DEBUG] Status HTTP (parsing) : {}", response.getStatusCode());

            FranceTravailSearchResponse body = response.getBody();
            if (body == null) {
                log.warn("⚠️ Body est NULL");
                return Collections.emptyList();
            }

            if (body.getResultats() == null) {
                log.warn("⚠️ body.getResultats() est NULL - problème de mapping JSON !");
                return Collections.emptyList();
            }

            if (body.getResultats().isEmpty()) {
                log.warn("⚠️ Liste vide (mais pas null)");
                return Collections.emptyList();
            }

            log.info("✅ {} offres récupérées", body.getResultats().size());
            return body.getResultats();

        } catch (Exception e) {
            log.error("❌ Erreur lors de la recherche d'offres : {}", e.getMessage(), e);
            throw new RuntimeException("Impossible de récupérer les offres : " + e.getMessage());
        }
    }
}