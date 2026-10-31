package jobradarbackend.jobradar.push;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jobradarbackend.jobradar.push.PushDtos.PublicKeyResponse;
import jobradarbackend.jobradar.push.PushDtos.SubscribeRequest;
import jobradarbackend.jobradar.push.PushDtos.TestResponse;
import jobradarbackend.jobradar.push.PushDtos.UnsubscribeRequest;
import jobradarbackend.jobradar.user.User;
import jobradarbackend.jobradar.user.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.security.Principal;
import java.util.Map;

/**
 * GET  /api/push/public-key   clé publique VAPID (pour pushManager.subscribe)
 * POST /api/push/subscribe    enregistre le navigateur de l'utilisateur connecté
 * POST /api/push/unsubscribe  supprime cet abonnement
 * POST /api/push/test         envoie une notification de test à ses appareils
 */
@RestController
@RequestMapping("/api/push")
public class PushController {

    private final WebPushService pushService;
    private final PushSubscriptionRepository repository;
    private final UserRepository userRepository;

    public PushController(WebPushService pushService, PushSubscriptionRepository repository, UserRepository userRepository) {
        this.pushService = pushService;
        this.repository = repository;
        this.userRepository = userRepository;
    }

    @GetMapping("/public-key")
    public PublicKeyResponse publicKey() {
        return new PublicKeyResponse(pushService.isEnabled() ? pushService.publicKey() : null, pushService.isEnabled());
    }

    @PostMapping("/subscribe")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void subscribe(@Valid @RequestBody SubscribeRequest request, Principal principal, HttpServletRequest http) {
        User user = currentUser(principal);
        // Le même navigateur peut changer de compte : l'abonnement suit l'utilisateur connecté
        PushSubscription s = repository.findByEndpoint(request.endpoint()).orElseGet(PushSubscription::new);
        s.setUser(user);
        s.setEndpoint(request.endpoint());
        s.setP256dh(request.keys().p256dh());
        s.setAuth(request.keys().auth());
        String agent = http.getHeader("User-Agent");
        s.setUserAgent(agent == null ? null : agent.substring(0, Math.min(agent.length(), 300)));
        repository.save(s);
    }

    @PostMapping("/unsubscribe")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void unsubscribe(@Valid @RequestBody UnsubscribeRequest request, Principal principal) {
        repository.deleteByEndpointAndUserId(request.endpoint(), currentUser(principal).getId());
    }

    @PostMapping("/test")
    public TestResponse test(Principal principal) {
        if (!pushService.isEnabled()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Web Push n'est pas configuré sur le serveur.");
        }
        User user = currentUser(principal);
        int devices = repository.findByUserId(user.getId()).size();
        int delivered = pushService.sendToUser(user.getId(), "JobRadar",
                "Les notifications sont activées sur cet appareil.", "/app", "test");
        return new TestResponse(devices, delivered);
    }

    private User currentUser(Principal principal) {
        if (principal == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Connexion requise.");
        return userRepository.findByEmail(principal.getName())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Utilisateur introuvable."));
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, Object>> handleStatus(ResponseStatusException e) {
        return ResponseEntity.status(e.getStatusCode())
                .body(Map.of("status", e.getStatusCode().value(), "message", String.valueOf(e.getReason())));
    }
}
