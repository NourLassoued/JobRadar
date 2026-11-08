package jobradarbackend.jobradar.applications;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ApplicationEventRepository extends JpaRepository<ApplicationEvent, Long> {
    List<ApplicationEvent> findByApplicationCandidateId(Long candidateId);

    /** Historique dans l'ordre chronologique */
    List<ApplicationEvent> findByApplicationIdOrderByCreatedAtAsc(Long applicationId);
}