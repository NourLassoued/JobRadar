package jobradarbackend.jobradar.push;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public final class PushDtos {

    private PushDtos() {
    }

    /** Clé publique VAPID, et false si le serveur n'a pas de clés configurées */
    public record PublicKeyResponse(String publicKey, boolean enabled) {}

    /** Ce que renvoie PushSubscription.toJSON() côté navigateur */
    public record SubscribeRequest(
            @NotBlank @Size(max = 1000) String endpoint,
            @NotNull @Valid Keys keys) {

        public record Keys(@NotBlank @Size(max = 200) String p256dh, @NotBlank @Size(max = 100) String auth) {}
    }

    public record UnsubscribeRequest(@NotBlank @Size(max = 1000) String endpoint) {}

    /** Résultat d'un envoi de test : combien d'appareils l'ont reçu */
    public record TestResponse(int devices, int delivered) {}
}
