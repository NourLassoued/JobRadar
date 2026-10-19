package jobradarbackend.jobradar.cv;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CandidateCvRepository extends JpaRepository<CandidateCv, Long> {

    /** Tous les CV d'un candidat, du plus récent au plus ancien */
    List<CandidateCv> findByCandidateIdOrderByCreatedAtDesc(Long candidateId);

    /** Le CV par défaut du candidat */
    Optional<CandidateCv> findFirstByCandidateIdAndDefaultCvTrue(Long candidateId);

    /** Un CV seulement s'il appartient bien à ce candidat (sécurité) */
    Optional<CandidateCv> findByIdAndCandidateId(Long id, Long candidateId);

    long countByCandidateId(Long candidateId);
}