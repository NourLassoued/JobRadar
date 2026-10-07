package jobradarbackend.jobradar.adzuna;

import lombok.Getter;

@Getter
public class AdzunaException extends RuntimeException {

    public enum Reason {
        /** Clés absentes dans la configuration */
        NOT_CONFIGURED,
        /** Pays absent de adzuna.countries */
        UNSUPPORTED_COUNTRY,
        /** Clés refusées par Adzuna (401/403) */
        INVALID_CREDENTIALS,
        /** Quota d'appels dépassé (429) */
        RATE_LIMITED,
        /** Paramètres refusés (400) */
        BAD_REQUEST,
        /** Adzuna indisponible, erreur 5xx ou délai dépassé */
        UNAVAILABLE
    }

    private final Reason reason;

    public AdzunaException(Reason reason, String message) {
        super(message);
        this.reason = reason;
    }

    public AdzunaException(Reason reason, String message, Throwable cause) {
        super(message, cause);
        this.reason = reason;
    }
}