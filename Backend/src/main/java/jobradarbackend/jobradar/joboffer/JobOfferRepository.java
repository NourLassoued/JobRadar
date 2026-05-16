package jobradarbackend.jobradar.joboffer;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;


@Repository
public interface JobOfferRepository extends JpaRepository<JobOffer, Long> {


    List<JobOffer> findBySector(String sector);


    List<JobOffer> findByLocation(String location);


    List<JobOffer> findByContractType(ContractType contractType);


    List<JobOffer> findByIsActiveTrue();


    List<JobOffer> findByRemoteTrue();
}