package jobradarbackend.jobradar.candidate;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;


@Repository
public interface CandidateRepository extends JpaRepository<Candidate, Long> {


    Optional<Candidate> findByEmail(String email);


    boolean existsByEmail(String email);


    List<Candidate> findBySector(SectorType sector);


    List<Candidate> findByCity(String city);


    List<Candidate> findByIsActiveTrue();


    List<Candidate> findByRemotePreferenceTrue();
}