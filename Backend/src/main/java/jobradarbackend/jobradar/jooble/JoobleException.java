package jobradarbackend.jobradar.jooble;

import lombok.Getter;

/** Erreur d'appel à Jooble, avec un motif exploitable par le contrôleur. */
@Getter
public class JoobleException extends RuntimeException {

    public enum Reason {
        /** Clé absente de la configuration */
        NOT_CONFIGURED,
        /** Clé refusée par Jooble (403) */
        INVALID_CREDENTIALS,
        /** Quota dépassé (429) */
        RATE_LIMITED,
        /** Requête refusée (400) */
        BAD_REQUEST,
        /** Jooble indisponible, erreur 5xx ou délai dépassé */
        UNAVAILABLE
    }

    private final Reason reason;

    public JoobleException(Reason reason, String message) {
        super(message);
        this.reason = reason;
    }

    public JoobleException(Reason reason, String message, Throwable cause) {
        super(message, cause);
        this.reason = reason;
    }
}