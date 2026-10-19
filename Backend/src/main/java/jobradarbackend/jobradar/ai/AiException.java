package jobradarbackend.jobradar.ai;

import lombok.Getter;
import org.springframework.http.HttpStatus;

@Getter
public class AiException extends RuntimeException {

    public enum Reason {
        NOT_CONFIGURED(HttpStatus.SERVICE_UNAVAILABLE),
        INVALID_KEY(HttpStatus.SERVICE_UNAVAILABLE),
        RATE_LIMITED(HttpStatus.TOO_MANY_REQUESTS),
        QUOTA_EXCEEDED(HttpStatus.TOO_MANY_REQUESTS),
        UNAVAILABLE(HttpStatus.SERVICE_UNAVAILABLE),
        BAD_RESPONSE(HttpStatus.BAD_GATEWAY),
        CV_TEXT_MISSING(HttpStatus.UNPROCESSABLE_ENTITY),
        NOT_FOUND(HttpStatus.NOT_FOUND);

        public final HttpStatus status;

        Reason(HttpStatus status) {
            this.status = status;
        }
    }

    private final Reason reason;

    public AiException(Reason reason, String message) {
        super(message);
        this.reason = reason;
    }

    public AiException(Reason reason, String message, Throwable cause) {
        super(message, cause);
        this.reason = reason;
    }
}