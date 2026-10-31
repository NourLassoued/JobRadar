package jobradarbackend.jobradar.notifications;

import jobradarbackend.jobradar.notifications.NotificationDtos.NotificationPage;
import jobradarbackend.jobradar.notifications.NotificationDtos.NotificationResponse;
import jobradarbackend.jobradar.push.WebPushService;
import jobradarbackend.jobradar.user.User;
import jobradarbackend.jobradar.user.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.security.Principal;
import java.time.LocalDateTime;

/**
 * Notifications de la cloche : création par les autres services, lecture par l'utilisateur connecté.
 * Chaque notification part aussi en Web Push sur les appareils de l'utilisateur (après le commit).
 */
@Service
public class NotificationService {

    private final NotificationRepository repository;
    private final UserRepository userRepository;
    private final WebPushService webPush;

    public NotificationService(NotificationRepository repository, UserRepository userRepository, WebPushService webPush) {
        this.repository = repository;
        this.userRepository = userRepository;
        this.webPush = webPush;
    }

    /** Appelé par les autres services (décision du recruteur, nouvelle candidature…) */
    @Transactional
    public void notify(User recipient, String type, String title, String body, String link) {
        if (recipient == null) return;
        Notification n = new Notification();
        n.setUser(recipient);
        n.setType(type);
        n.setTitle(truncate(title, 200));
        n.setBody(body);
        n.setLink(truncate(link, 300));
        repository.save(n);

        // Même message sur le bureau / le téléphone, même JobRadar fermé
        webPush.sendToUserAfterCommit(recipient.getId(), n.getTitle(), body, link, type);
    }

    @Transactional(readOnly = true)
    public NotificationPage list(Principal principal) {
        Long userId = currentUser(principal).getId();
        return new NotificationPage(
                repository.findTop30ByUserIdOrderByCreatedAtDesc(userId).stream().map(NotificationResponse::from).toList(),
                repository.countByUserIdAndReadAtIsNull(userId));
    }

    @Transactional
    public void markRead(Principal principal, Long id) {
        Notification n = repository.findByIdAndUserId(id, currentUser(principal).getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Notification introuvable."));
        if (n.getReadAt() == null) n.setReadAt(LocalDateTime.now());
    }

    @Transactional
    public void markAllRead(Principal principal) {
        repository.markAllRead(currentUser(principal).getId(), LocalDateTime.now());
    }

    private User currentUser(Principal principal) {
        if (principal == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Connexion requise.");
        return userRepository.findByEmail(principal.getName())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Utilisateur introuvable."));
    }

    private static String truncate(String value, int max) {
        return value == null || value.length() <= max ? value : value.substring(0, max);
    }
}