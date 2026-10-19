package jobradarbackend.jobradar.cv;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CvAdaptationRepository extends JpaRepository<CvAdaptation, Long> {

    /** Historique des adaptations d'un CV */
    List<CvAdaptation> findByCvIdOrderByCreatedAtDesc(Long cvId);

    /** Adaptations du candidat pour une offre (tous CV confondus) */
    List<CvAdaptation> findByCvCandidateIdAndJobOfferIdOrderByCreatedAtDesc(Long candidateId, Long jobOfferId);

    /** Une adaptation seulement si elle appartient à ce candidat (sécurité) */
    Optional<CvAdaptation> findByIdAndCvCandidateId(Long id, Long candidateId);

    /** Adaptation retenue pour une candidature */
    Optional<CvAdaptation> findFirstByApplicationIdAndStatus(Long applicationId, CvAdaptationStatus status);
}