package jobradarbackend.jobradar.jooble;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Configuration Jooble (lignes « jooble.* » de application.properties).
 * Jooble n'utilise qu'une seule clé, placée dans le chemin de l'URL : POST /api/{clé}.
 */
@Getter
@Setter
@Component
@ConfigurationProperties(prefix = "jooble")
public class JoobleProperties {

    private String apiKey;

    private String baseUrl = "https://jooble.org/api";

    /** Lieu utilisé quand aucun n'est précisé (Jooble déduit le pays du lieu) */
    private String defaultLocation = "France";

    private int resultsPerPage = 20;
    private int connectTimeoutMs = 5_000;
    private int readTimeoutMs = 15_000;

    private Sync sync = new Sync();

    @Getter
    @Setter
    public static class Sync {
        /** Active la synchronisation nocturne */
        private boolean enabled = false;
        /** Lieux synchronisés (appels par nuit = lieux × secteurs × pages) */
        private List<String> locations = List.of("France");
        /** Pages par secteur : 1 par défaut, le quota Jooble est limité */
        private int pagesPerSector = 1;
        /** Expression cron : 4 h du matin, après France Travail (2 h) et Adzuna (3 h) */
        private String cron = "0 0 4 * * *";
    }

    public boolean isConfigured() {
        return apiKey != null && !apiKey.isBlank();
    }
}