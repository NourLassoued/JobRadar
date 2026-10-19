package jobradarbackend.jobradar.ai.groq;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;


@Getter
@Setter
@Component
@ConfigurationProperties(prefix = "groq")
public class GroqProperties {

    private String apiKey;
    private String baseUrl = "https://api.groq.com/openai/v1";
    /** Modèle de production Groq, bon en français. Liste : console.groq.com/docs/models */
    private String model = "llama-3.3-70b-versatile";
    private int connectTimeoutMs = 10_000;
    private int readTimeoutMs = 60_000;

    public boolean isConfigured() {
        return apiKey != null && !apiKey.isBlank() && !apiKey.startsWith("VOTRE");
    }
}