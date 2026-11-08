package jobradarbackend.jobradar.joboffer.quality;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * Résultat du contrôle qualité d'une offre importée (France Travail, Adzuna, Jooble).
 * Une ligne par offre ; table séparée pour ne pas toucher à job_offers.
 */
@Entity
@Table(name = "offer_quality", indexes = {
        @Index(name = "idx_offer_quality_hidden", columnList = "hidden_by_check"),
        @Index(name = "idx_offer_quality_duplicate", columnList = "duplicate_of")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OfferQuality {

    /** Même identifiant que l'offre (job_offers.id) */
    @Id
    @Column(name = "offer_id")
    private Long offerId;

    /** Note de qualité de 0 à 100 */
    @Column(nullable = false)
    private int score;

    /** Problèmes détectés, séparés par « | » */
    @Column(columnDefinition = "TEXT")
    private String issues;

    /** Offre conservée dont celle-ci est un doublon (null si ce n'est pas un doublon) */
    @Column(name = "duplicate_of")
    private Long duplicateOf;

    /** true si C'EST ce contrôle qui a désactivé l'offre (il peut donc la réactiver) */
    @Column(name = "hidden_by_check", nullable = false)
    private boolean hiddenByCheck;

    @Column(name = "checked_at", nullable = false)
    private LocalDateTime checkedAt;
}
