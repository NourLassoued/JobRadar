package jobradarbackend.jobradar.notifications;

import java.time.LocalDateTime;
import java.util.List;

public final class NotificationDtos {

    private NotificationDtos() {
    }

    /** Une notification envoyée au front */
    public record NotificationResponse(Long id, String type, String title, String body, String link,
                                       boolean read, LocalDateTime createdAt) {

        static NotificationResponse from(Notification n) {
            return new NotificationResponse(n.getId(), n.getType(), n.getTitle(), n.getBody(), n.getLink(),
                    n.getReadAt() != null, n.getCreatedAt());
        }
    }

    /** GET /api/notifications : la liste et le nombre de non lues (pastille de la cloche) */
    public record NotificationPage(List<NotificationResponse> items, long unread) {}
}