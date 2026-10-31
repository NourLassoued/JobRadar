package jobradarbackend.jobradar.notifications;

import jakarta.servlet.http.HttpServletResponse;
import jobradarbackend.jobradar.notifications.NotificationDtos.NotificationPage;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.security.Principal;
import java.util.Map;

/**
 * GET   /api/notifications            : 30 dernières + nombre de non lues
 * GET   /api/notifications/stream     : flux temps réel (Server-Sent Events)
 * PATCH /api/notifications/{id}/read  : marquer comme lue
 * PATCH /api/notifications/read-all   : tout marquer comme lu
 */
@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

    private final NotificationService service;
    private final NotificationStream stream;

    public NotificationController(NotificationService service, NotificationStream stream) {
        this.service = service;
        this.stream = stream;
    }

    @GetMapping
    public NotificationPage list(Principal principal) {
        return service.list(principal);
    }

    /** Reste ouvert : le serveur y écrit chaque nouvelle notification dès qu'elle est créée */
    @GetMapping(path = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter stream(Principal principal, HttpServletResponse response) {
        if (principal == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Connexion requise.");
        // Pas de mise en mémoire tampon par un proxy (nginx) ni par le navigateur
        response.setHeader("Cache-Control", "no-cache");
        response.setHeader("X-Accel-Buffering", "no");
        return stream.subscribe(principal.getName());
    }

    @PatchMapping("/{id}/read")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void markRead(@PathVariable Long id, Principal principal) {
        service.markRead(principal, id);
    }

    @PatchMapping("/read-all")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void markAllRead(Principal principal) {
        service.markAllRead(principal);
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, Object>> handleStatus(ResponseStatusException e) {
        return ResponseEntity.status(e.getStatusCode())
                .body(Map.of("status", e.getStatusCode().value(), "message", String.valueOf(e.getReason())));
    }
}