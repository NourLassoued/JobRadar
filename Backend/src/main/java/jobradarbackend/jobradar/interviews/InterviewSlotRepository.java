package jobradarbackend.jobradar.interviews;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface InterviewSlotRepository extends JpaRepository<InterviewSlot, Long> {

    List<InterviewSlot> findByApplicationIdAndStatusInOrderByStartsAtAsc(Long applicationId,
                                                                        Collection<InterviewSlot.Status> statuses);

    /** Un créneau n'est modifiable que via sa candidature */
    Optional<InterviewSlot> findByIdAndApplicationId(Long id, Long applicationId);
}
