package jobradarbackend.jobradar.candidate;

import jobradarbackend.jobradar.user.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;


@Repository
public interface CandidateRepository extends JpaRepository<Candidate, Long> {


    Optional<Candidate> findByEmail(String email);
    Optional<Candidate> findByUser(User user);


    boolean existsByEmail(String email);


    List<Candidate> findBySector(SectorType sector);


    List<Candidate> findByCity(String city);


    List<Candidate> findByIsActiveTrue();
    Optional<Candidate> findByUserId(Long userId);


    List<Candidate> findByRemotePreferenceTrue();
}