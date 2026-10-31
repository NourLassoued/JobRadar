package jobradarbackend.jobradar.notifications;

import jakarta.annotation.PreDestroy;
import jobradarbackend.jobradar.notifications.NotificationDtos.NotificationResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;


@Component
public class NotificationStream {

    private static final Logger log = LoggerFactory.getLogger(NotificationStream.class);

    /** Le navigateur se reconnecte tout seul après ce délai */
    private static final long TIMEOUT_MS = TimeUnit.MINUTES.toMillis(30);
    /** Un commentaire « ping » régulier empêche les proxys de couper une connexion silencieuse */
    private static final long HEARTBEAT_SECONDS = 25;

    private final Map<String, List<SseEmitter>> emitters = new ConcurrentHashMap<>();
    private final ScheduledExecutorService heartbeat = Executors.newSingleThreadScheduledExecutor(r -> {
        Thread t = new Thread(r, "notifications-heartbeat");
        t.setDaemon(true);
        return t;
    });

    public NotificationStream() {
        heartbeat.scheduleAtFixedRate(this::ping, HEARTBEAT_SECONDS, HEARTBEAT_SECONDS, TimeUnit.SECONDS);
    }

    /** Ouvre le flux d'un onglet */
    public SseEmitter subscribe(String email) {
        SseEmitter emitter = new SseEmitter(TIMEOUT_MS);
        List<SseEmitter> list = emitters.computeIfAbsent(key(email), k -> new CopyOnWriteArrayList<>());
        list.add(emitter);

        Runnable remove = () -> remove(email, emitter);
        emitter.onCompletion(remove);
        emitter.onTimeout(remove);
        emitter.onError(e -> remove.run());

        try {
            // Premier message : confirme au navigateur que le flux est ouvert
            emitter.send(SseEmitter.event().comment("connected"));
        } catch (IOException e) {
            remove.run();
        }
        return emitter;
    }

    /** Pousse une notification dans tous les onglets ouverts de ce destinataire */
    public void send(String email, NotificationResponse notification) {
        List<SseEmitter> list = emitters.get(key(email));
        if (list == null) return;
        for (SseEmitter emitter : list) {
            try {
                emitter.send(SseEmitter.event()
                        .name("notification")
                        .id(String.valueOf(notification.id()))
                        .data(notification, MediaType.APPLICATION_JSON));
            } catch (IOException | IllegalStateException e) {
                // Onglet fermé entre-temps
                remove(email, emitter);
            }
        }
    }

    /** Nombre d'onglets connectés (utile pour les logs et le débogage) */
    public int connections() {
        return emitters.values().stream().mapToInt(List::size).sum();
    }

    private void ping() {
        emitters.forEach((email, list) -> {
            for (SseEmitter emitter : list) {
                try {
                    emitter.send(SseEmitter.event().comment("ping"));
                } catch (IOException | IllegalStateException e) {
                    remove(email, emitter);
                }
            }
        });
    }

    private void remove(String email, SseEmitter emitter) {
        emitters.computeIfPresent(key(email), (k, list) -> {
            list.remove(emitter);
            return list.isEmpty() ? null : list;
        });
    }

    private static String key(String email) {
        return email == null ? "" : email.toLowerCase();
    }

    @PreDestroy
    void shutdown() {
        heartbeat.shutdownNow();
        emitters.values().forEach(list -> list.forEach(SseEmitter::complete));
        emitters.clear();
        log.debug("Flux de notifications fermés");
    }
}