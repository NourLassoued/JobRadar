package jobradarbackend.jobradar.push;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

public interface PushSubscriptionRepository extends JpaRepository<PushSubscription, Long> {

    List<PushSubscription> findByUserId(Long userId);

    Optional<PushSubscription> findByEndpoint(String endpoint);

    @Transactional
    void deleteByEndpoint(String endpoint);

    @Transactional
    void deleteByEndpointAndUserId(String endpoint, Long userId);
}
