package jobradarbackend.jobradar.joboffer.quality;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface OfferQualityRepository extends JpaRepository<OfferQuality, Long> {

    List<OfferQuality> findByHiddenByCheckTrue();
}
