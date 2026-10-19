package jobradarbackend.jobradar.ai;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Réglages généraux de l'IA (application.properties) :
 *   ai.provider=groq
 *   ai.daily-limit-per-user=10
 */
@Getter
@Setter
@Component
@ConfigurationProperties(prefix = "ai")
public class AiProperties {

    private String provider = "groq";

    /** Nombre de générations par utilisateur et par jour (CV + lettres) */
    private int dailyLimitPerUser = 10;
}