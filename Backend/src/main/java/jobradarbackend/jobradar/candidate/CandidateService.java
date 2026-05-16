package jobradarbackend.jobradar.candidate;

import jobradarbackend.jobradar.candidate.dto.CandidateRequest;
import jobradarbackend.jobradar.candidate.dto.CandidateResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;


@Slf4j
@Service
@RequiredArgsConstructor
@Transactional
public class CandidateService {

    private final CandidateRepository repository;

    public CandidateResponse create(CandidateRequest request) {
        log.info("Création candidat : {}", request.getEmail());

        if (repository.existsByEmail(request.getEmail())) {
            throw new IllegalArgumentException(
                    "Un candidat avec l'email " + request.getEmail() + " existe déjà."
            );
        }

        Candidate candidate = Candidate.builder()
                .firstName(request.getFirstName())
                .lastName(request.getLastName())
                .email(request.getEmail().toLowerCase().trim())
                .phoneNumber(request.getPhoneNumber())
                .city(request.getCity())
                .sector(request.getSector())
                .yearsOfExperience(request.getYearsOfExperience())
                .skills(request.getSkills())
                .bio(request.getBio())
                .expectedSalary(request.getExpectedSalary())
                .remotePreference(request.getRemotePreference() != null ? request.getRemotePreference() : false)
                .cvUrl(request.getCvUrl())
                .linkedinUrl(request.getLinkedinUrl())
                .isActive(true)
                .build();

        Candidate saved = repository.save(candidate);
        log.info("✅ Candidat créé avec ID : {}", saved.getId());

        return CandidateResponse.fromEntity(saved);
    }


    @Transactional(readOnly = true)
    public List<CandidateResponse> findAll() {
        return repository.findAll().stream()
                .map(CandidateResponse::fromEntity)
                .toList();
    }

    @Transactional(readOnly = true)
    public CandidateResponse findById(Long id) {
        Candidate c = repository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException(
                        "Candidat introuvable avec l'ID : " + id
                ));
        return CandidateResponse.fromEntity(c);
    }

    @Transactional(readOnly = true)
    public List<CandidateResponse> findBySector(SectorType sector) {
        return repository.findBySector(sector).stream()
                .map(CandidateResponse::fromEntity)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<CandidateResponse> findByCity(String city) {
        return repository.findByCity(city).stream()
                .map(CandidateResponse::fromEntity)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<CandidateResponse> findActiveCandidates() {
        return repository.findByIsActiveTrue().stream()
                .map(CandidateResponse::fromEntity)
                .toList();
    }


    public CandidateResponse update(Long id, CandidateRequest request) {
        log.info("Mise à jour du candidat ID : {}", id);

        Candidate existing = repository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException(
                        "Candidat introuvable avec l'ID : " + id
                ));

        if (!existing.getEmail().equals(request.getEmail())
                && repository.existsByEmail(request.getEmail())) {
            throw new IllegalArgumentException("Cet email est déjà utilisé.");
        }

        existing.setFirstName(request.getFirstName());
        existing.setLastName(request.getLastName());
        existing.setEmail(request.getEmail().toLowerCase().trim());
        existing.setPhoneNumber(request.getPhoneNumber());
        existing.setCity(request.getCity());
        existing.setSector(request.getSector());
        existing.setYearsOfExperience(request.getYearsOfExperience());
        existing.setSkills(request.getSkills());
        existing.setBio(request.getBio());
        existing.setExpectedSalary(request.getExpectedSalary());
        existing.setRemotePreference(request.getRemotePreference() != null ? request.getRemotePreference() : false);
        existing.setCvUrl(request.getCvUrl());
        existing.setLinkedinUrl(request.getLinkedinUrl());

        Candidate updated = repository.save(existing);
        log.info(" Candidat mis à jour");

        return CandidateResponse.fromEntity(updated);
    }

    public void delete(Long id) {
        log.info("Suppression du candidat ID : {}", id);

        if (!repository.existsById(id)) {
            throw new IllegalArgumentException("Candidat introuvable avec l'ID : " + id);
        }

        repository.deleteById(id);
        log.info("Candidat supprimé");
    }


    public CandidateResponse archive(Long id) {
        log.info("Archivage du candidat ID : {}", id);

        Candidate c = repository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException(
                        "Candidat introuvable avec l'ID : " + id
                ));

        c.setIsActive(false);
        Candidate saved = repository.save(c);
        log.info("Candidat archivé");

        return CandidateResponse.fromEntity(saved);
    }
}