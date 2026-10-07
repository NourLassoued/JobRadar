package jobradarbackend.jobradar.adzuna;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Configuration Adzuna (bloc « adzuna: » de application.yml).
 * Les clés viennent des variables d'environnement ADZUNA_APP_ID / ADZUNA_APP_KEY.
 */
@Getter
@Setter
@Component
@ConfigurationProperties(prefix = "adzuna")
public class AdzunaProperties {

    private String appId;
    private String appKey;

    private String baseUrl = "https://api.adzuna.com/v1/api";

    /** Pays autorisés pour la recherche (codes Adzuna) */
    private List<String> countries = List.of(
            "at", // Autriche
            "au", // Australie
            "be", // Belgique
            "br", // Brésil
            "ca", // Canada
            "ch", // Suisse
            "de", // Allemagne
            "es", // Espagne
            "fr", // France
            "gb", // Royaume-Uni
            "hk", // Hong Kong (à vérifier : renvoie une erreur si Adzuna ne couvre pas ce pays)
            "in", // Inde
            "it", // Italie
            "mx", // Mexique
            "my", // Malaisie (à vérifier)
            "nl", // Pays-Bas
            "nz", // Nouvelle-Zélande
            "pl", // Pologne
            "sg", // Singapour
            "us", // États-Unis
            "za"  // Afrique du Sud
    );

    /** Pays utilisé quand aucun n'est précisé */
    private String defaultCountry = "fr";

    private int resultsPerPage = 20;
    private int connectTimeoutMs = 5_000;
    private int readTimeoutMs = 10_000;

    private Sync sync = new Sync();

    @Getter
    @Setter
    public static class Sync {
        /** Active la synchronisation nocturne */
        private boolean enabled = false;
        /**
         * Pays synchronisés chaque nuit. Volontairement court :
         * appels = pays × secteurs × pages (1 × 14 × 2 = 28 par nuit).
         */
        private List<String> countries = List.of("fr");
        /** Pages importées par secteur et par pays */
        private int pagesPerSector = 2;
        /** Expression cron : par défaut 3 h du matin, après France Travail */
        private String cron = "0 0 3 * * *";
    }

    /** Pays dont la devise est l'euro : seuls leurs salaires sont enregistrés (le frontend affiche des €) */
    private static final Set<String> EURO_COUNTRIES = Set.of("at", "be", "de", "es", "fr", "it", "nl");

    /** Vrai si les deux clés sont renseignées */
    public boolean isConfigured() {
        return appId != null && !appId.isBlank() && appKey != null && !appKey.isBlank();
    }

    /** « FR », « fr », null → code normalisé ; null si le pays n'est pas autorisé */
    public String resolveCountry(String country) {
        String code = (country == null || country.isBlank() ? defaultCountry : country)
                .trim().toLowerCase(Locale.ROOT);
        return countries.contains(code) ? code : null;
    }

    public boolean isEuroCountry(String country) {
        return country != null && EURO_COUNTRIES.contains(country.toLowerCase(Locale.ROOT));
    }
}