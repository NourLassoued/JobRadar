package jobradarbackend.jobradar.applications;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface ApplicationRepository extends JpaRepository<Application, Long> {

    List<Application> findByCandidateIdOrderByUpdatedAtDesc(Long candidateId);

    /** Une colonne du Kanban */
    List<Application> findByCandidateIdAndStatusOrderByPositionAsc(Long candidateId, ApplicationStatus status);

    /** Une candidature seulement si elle appartient à ce candidat (sécurité) */
    Optional<Application> findByIdAndCandidateId(Long id, Long candidateId);

    /** Évite de postuler deux fois à la même offre */
    boolean existsByCandidateIdAndJobOfferId(Long candidateId, Long jobOfferId);

    Optional<Application> findByCandidateIdAndJobOfferId(Long candidateId, Long jobOfferId);

    /** Compteurs pour le tableau de bord */
    long countByCandidateIdAndStatus(Long candidateId, ApplicationStatus status);

    /** Relances à faire : prochaine action aujourd'hui ou en retard */
    List<Application> findByCandidateIdAndNextActionAtLessThanEqualOrderByNextActionAtAsc(Long candidateId, LocalDate date);
}