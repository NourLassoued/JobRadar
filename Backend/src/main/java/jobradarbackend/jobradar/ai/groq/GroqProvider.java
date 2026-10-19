package jobradarbackend.jobradar.ai.groq;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import jobradarbackend.jobradar.ai.AiException;
import jobradarbackend.jobradar.ai.AiProvider;
import jobradarbackend.jobradar.ai.AiRequest;
import jobradarbackend.jobradar.ai.AiResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.util.List;


@Slf4j
@Component
@ConditionalOnProperty(name = "ai.provider", havingValue = "groq", matchIfMissing = true)
public class GroqProvider implements AiProvider {

    private final GroqProperties props;
    private final RestClient restClient;

    public GroqProvider(GroqProperties props) {
        this.props = props;
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(props.getConnectTimeoutMs());
        factory.setReadTimeout(props.getReadTimeoutMs());
        this.restClient = RestClient.builder()
                .baseUrl(props.getBaseUrl())
                .requestFactory(factory)
                .build();
    }

    @Override
    public String name() {
        return "groq/" + props.getModel();
    }

    @Override
    public AiResponse complete(AiRequest request) {
        if (!props.isConfigured()) {
            throw new AiException(AiException.Reason.NOT_CONFIGURED,
                    "L'IA n'est pas configurée (groq.api-key manquant dans application.properties).");
        }

        ChatRequest body = new ChatRequest(
                props.getModel(),
                List.of(new Message("system", request.systemPrompt()), new Message("user", request.userPrompt())),
                request.temperature(),
                request.maxTokens(),
                request.jsonOutput() ? new ResponseFormat("json_object") : null);

        long start = System.currentTimeMillis();
        try {
            ChatResponse response = restClient.post()
                    .uri("/chat/completions")
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + props.getApiKey())
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(ChatResponse.class);

            if (response == null || response.choices() == null || response.choices().isEmpty()
                    || response.choices().get(0).message() == null) {
                throw new AiException(AiException.Reason.BAD_RESPONSE, "Réponse vide de l'IA.");
            }

            String content = response.choices().get(0).message().content();
            int in = response.usage() == null ? 0 : response.usage().promptTokens();
            int out = response.usage() == null ? 0 : response.usage().completionTokens();
            log.info("Groq [{}] : {} tokens entrée, {} tokens sortie, {} ms",
                    props.getModel(), in, out, System.currentTimeMillis() - start);
            return new AiResponse(content, name(), in, out);

        } catch (RestClientResponseException e) {
            int status = e.getStatusCode().value();
            log.warn("Groq a répondu HTTP {} : {}", status, e.getResponseBodyAsString());
            throw switch (status) {
                case 401, 403 -> new AiException(AiException.Reason.INVALID_KEY, "Clé Groq refusée : vérifiez groq.api-key.");
                case 429 -> new AiException(AiException.Reason.RATE_LIMITED, "Limite gratuite Groq atteinte. Réessayez dans une minute.");
                case 400 -> new AiException(AiException.Reason.BAD_RESPONSE, "Requête refusée par Groq (texte trop long ou modèle inconnu).");
                default -> new AiException(AiException.Reason.UNAVAILABLE, "Groq est temporairement indisponible (HTTP " + status + ").");
            };
        } catch (ResourceAccessException e) {
            log.warn("Groq injoignable : {}", e.getMessage());
            throw new AiException(AiException.Reason.UNAVAILABLE, "L'IA ne répond pas. Réessayez dans un instant.", e);
        }
    }

    // ── Format de l'API (compatible OpenAI) ──────────────────

    @JsonInclude(JsonInclude.Include.NON_NULL)
    record ChatRequest(String model, List<Message> messages, double temperature,
                       @JsonProperty("max_tokens") int maxTokens,
                       @JsonProperty("response_format") ResponseFormat responseFormat) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    record Message(String role, String content) {}

    record ResponseFormat(String type) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    record ChatResponse(List<Choice> choices, Usage usage) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    record Choice(Message message) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    record Usage(@JsonProperty("prompt_tokens") int promptTokens,
                 @JsonProperty("completion_tokens") int completionTokens) {}
}