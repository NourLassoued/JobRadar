package jobradarbackend.jobradar.applications;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface ApplicationActivityRepository extends JpaRepository<ApplicationActivity, Long> {

    List<ApplicationActivity> findByApplicationIdOrderByScheduledAtAsc(Long applicationId);

    /** Un événement seulement s'il appartient à cette candidature (sécurité) */
    Optional<ApplicationActivity> findByIdAndApplicationId(Long id, Long applicationId);

    /** Événements à venir de toutes les candidatures d'un candidat (prochaine date sur chaque carte) */
    List<ApplicationActivity> findByApplicationCandidateIdAndDoneFalseAndScheduledAtAfterOrderByScheduledAtAsc(
            Long candidateId, LocalDateTime after);
}
