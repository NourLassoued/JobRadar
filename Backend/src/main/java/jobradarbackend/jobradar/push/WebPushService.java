package jobradarbackend.jobradar.push;

import jakarta.annotation.PreDestroy;

import nl.martijndwars.webpush.Subscription;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import nl.martijndwars.webpush.PushService;
import java.nio.charset.StandardCharsets;
import java.security.Security;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;


@Service
public class WebPushService {

    private static final Logger log = LoggerFactory.getLogger(WebPushService.class);

    private final PushSubscriptionRepository repository;
    private final String publicKey;
    private final PushService pushService;
    private final ExecutorService executor = Executors.newFixedThreadPool(2, r -> {
        Thread t = new Thread(r, "web-push");
        t.setDaemon(true);
        return t;
    });

    public WebPushService(PushSubscriptionRepository repository,
                          @Value("${app.webpush.public-key:}") String publicKey,
                          @Value("${app.webpush.private-key:}") String privateKey,
                          @Value("${app.webpush.subject:mailto:contact@jobradar.local}") String subject) {
        this.repository = repository;
        this.publicKey = publicKey;
        this.pushService = createPushService(publicKey, privateKey, subject);
    }

    private static PushService createPushService(String publicKey, String privateKey, String subject) {
        if (publicKey == null || publicKey.isBlank() || privateKey == null || privateKey.isBlank()) {
            log.warn("Web Push désactivé : app.webpush.public-key / private-key absents");
            return null;
        }
        try {
            if (Security.getProvider(BouncyCastleProvider.PROVIDER_NAME) == null) {
                Security.addProvider(new BouncyCastleProvider());
            }
            return new PushService(publicKey, privateKey, subject);
        } catch (Exception e) {
            log.error("Web Push désactivé : clés VAPID invalides ({})", e.getMessage());
            return null;
        }
    }

    public boolean isEnabled() {
        return pushService != null;
    }

    public String publicKey() {
        return publicKey;
    }

    /** Envoie à tous les navigateurs de l'utilisateur, après le commit de la transaction en cours */
    public void sendToUserAfterCommit(Long userId, String title, String body, String link, String tag) {
        if (!isEnabled() || userId == null) return;
        Runnable task = () -> executor.submit(() -> sendToUser(userId, title, body, link, tag));
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    task.run();
                }
            });
        } else {
            task.run();
        }
    }

    /** Envoi immédiat (utilisé par l'envoi de test) ; renvoie le nombre d'appareils atteints */
    public int sendToUser(Long userId, String title, String body, String link, String tag) {
        if (!isEnabled()) return 0;
        List<PushSubscription> subscriptions = repository.findByUserId(userId);
        String payload = toJson(title, body, link, tag);
        int delivered = 0;
        for (PushSubscription s : subscriptions) {
            if (deliver(s, payload)) delivered++;
        }
        return delivered;
    }

    private boolean deliver(PushSubscription s, String payload) {
        try {
            Subscription target = new Subscription(s.getEndpoint(), new Subscription.Keys(s.getP256dh(), s.getAuth()));
            var response = pushService.send(new nl.martijndwars.webpush.Notification(target, payload));
            int status = response.getStatusLine().getStatusCode();
            if (status == 404 || status == 410) {
                // Le navigateur s'est désabonné ou l'abonnement a expiré
                repository.deleteByEndpoint(s.getEndpoint());
                log.info("Abonnement push expiré supprimé (utilisateur {})", s.getUser().getId());
                return false;
            }
            if (status >= 200 && status < 300) {
                s.setLastSuccessAt(LocalDateTime.now());
                repository.save(s);
                return true;
            }
            log.warn("Push refusé par le service ({}) pour l'abonnement {}", status, s.getId());
            return false;
        } catch (Exception e) {
            log.warn("Push non envoyé pour l'abonnement {} : {}", s.getId(), e.getMessage());
            return false;
        }
    }

    /** Message lu par le service worker : { title, body, url, tag } */
    static String toJson(String title, String body, String link, String tag) {
        Map<String, String> fields = new LinkedHashMap<>();
        fields.put("title", title);
        fields.put("body", body);
        fields.put("url", link);
        fields.put("tag", tag);
        StringBuilder json = new StringBuilder("{");
        fields.forEach((k, v) -> {
            if (v == null) return;
            if (json.length() > 1) json.append(',');
            json.append('"').append(k).append("\":\"").append(escape(v)).append('"');
        });
        String result = json.append('}').toString();
        // Les services de push limitent le message à environ 4 Ko
        return result.getBytes(StandardCharsets.UTF_8).length > 3800
                ? toJson(title, body == null ? null : body.substring(0, Math.min(body.length(), 300)) + "…", link, tag)
                : result;
    }

    private static String escape(String value) {
        StringBuilder out = new StringBuilder();
        for (char c : value.toCharArray()) {
            switch (c) {
                case '"' -> out.append("\\\"");
                case '\\' -> out.append("\\\\");
                case '\n' -> out.append("\\n");
                case '\r' -> out.append("\\r");
                case '\t' -> out.append("\\t");
                default -> {
                    if (c < 0x20) out.append(String.format("\\u%04x", (int) c));
                    else out.append(c);
                }
            }
        }
        return out.toString();
    }

    @PreDestroy
    void shutdown() {
        executor.shutdown();
    }
}
