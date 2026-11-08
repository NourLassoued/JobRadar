package jobradarbackend.jobradar.interviews;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;


@Component
public class InterviewCalendar {

    private static final DateTimeFormatter UTC = DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss'Z'");

    private final ZoneId zone;
    private final String frontendUrl;

    public InterviewCalendar(@Value("${app.timezone:Africa/Tunis}") String timezone,
                             @Value("${app.frontend-url:http://localhost:4200}") String frontendUrl) {
        this.zone = ZoneId.of(timezone);
        this.frontendUrl = frontendUrl.replaceAll("/+$", "");
    }


    public String googleUrl(String title, LocalDateTime start, LocalDateTime end,
                            String mode, String location, String path) {
        StringBuilder details = new StringBuilder("Entretien organisé via JobRadar\n")
                .append("Format : ").append(mode);
        if (location != null && !location.isBlank()) details.append("\n").append(location);
        if (path != null) details.append("\n\nVoir sur JobRadar : ").append(frontendUrl).append(path);

        StringBuilder url = new StringBuilder("https://calendar.google.com/calendar/render?action=TEMPLATE")
                .append("&text=").append(encode(title))
                .append("&dates=").append(utc(start)).append('/').append(utc(end))
                .append("&details=").append(encode(details.toString()));
        if (location != null && !location.isBlank()) url.append("&location=").append(encode(location));
        return url.toString();
    }

    private String utc(LocalDateTime local) {
        return UTC.format(local.atZone(zone).withZoneSameInstant(ZoneOffset.UTC));
    }

    private static String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }
}
