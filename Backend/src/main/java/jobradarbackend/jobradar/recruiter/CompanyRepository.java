package jobradarbackend.jobradar.recruiter;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface CompanyRepository extends JpaRepository<Company, Long> {

    /** Entreprise du recruteur connecté */
    Optional<Company> findByOwnerId(Long ownerId);
}