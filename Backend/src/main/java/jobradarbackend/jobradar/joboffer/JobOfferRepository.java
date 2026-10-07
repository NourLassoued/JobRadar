package jobradarbackend.jobradar.joboffer;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;


@Repository
public interface JobOfferRepository extends JpaRepository<JobOffer, Long> {


    List<JobOffer> findBySector(String sector);


    List<JobOffer> findByLocation(String location);


    List<JobOffer> findByContractType(ContractType contractType);


    List<JobOffer> findByIsActiveTrue();

    Optional<JobOffer> findByExternalId(String externalId);

    List<JobOffer> findByRemoteTrue();
}