package jobradarbackend.jobradar.francetravail;

import jobradarbackend.jobradar.francetravail.dtoFrancetrvail.OAuthTokenResponse;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDateTime;


@Slf4j
@Service
public class FranceTravailAuthService {

    @Value("${francetravail.client-id}")
    private String clientId;

    @Value("${francetravail.client-secret}")
    private String clientSecret;

    @Value("${francetravail.token-url}")
    private String tokenUrl;

    @Value("${francetravail.scopes}")
    private String scopes;

    private final RestTemplate restTemplate = new RestTemplate();

    // Cache du token (évite de redemander à chaque appel)
    private String cachedToken;
    private LocalDateTime tokenExpiresAt;


    public String getAccessToken() {
        if (cachedToken != null && tokenExpiresAt != null
                && LocalDateTime.now().isBefore(tokenExpiresAt)) {
            log.debug("Utilisation du token en cache");
            return cachedToken;
        }

        return requestNewToken();
    }


    private String requestNewToken() {
        log.info("Demande d'un nouveau token OAuth à France Travail");

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);

        MultiValueMap<String, String> body = new LinkedMultiValueMap<>();
        body.add("grant_type", "client_credentials");
        body.add("client_id", clientId);
        body.add("client_secret", clientSecret);
        body.add("scope", scopes);

        HttpEntity<MultiValueMap<String, String>> request = new HttpEntity<>(body, headers);

        try {
            ResponseEntity<OAuthTokenResponse> response = restTemplate.postForEntity(
                    tokenUrl,
                    request,
                    OAuthTokenResponse.class
            );

            OAuthTokenResponse tokenResponse = response.getBody();
            if (tokenResponse == null) {
                throw new RuntimeException("Réponse OAuth vide");
            }

            cachedToken = tokenResponse.getAccessToken();
            tokenExpiresAt = LocalDateTime.now()
                    .plusSeconds(tokenResponse.getExpiresIn() - 60);

            log.info("Token OAuth obtenu (expire dans {}s)", tokenResponse.getExpiresIn());
            return cachedToken;

        } catch (Exception e) {
            log.error(" Erreur lors de l'obtention du token", e);
            throw new RuntimeException("Impossible d'obtenir le token OAuth : " + e.getMessage());
        }
    }
}