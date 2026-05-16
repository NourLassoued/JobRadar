package jobradarbackend.jobradar.joboffer;

import jobradarbackend.jobradar.joboffer.DtoJoboffer.JobOfferRequest;
import jobradarbackend.jobradar.joboffer.DtoJoboffer.JobOfferResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;


@Slf4j
@Service
@RequiredArgsConstructor
@Transactional
public class JobOfferService {

    private final JobOfferRepository repository;


    public JobOfferResponse create(JobOfferRequest request) {
        log.info("Création offre : {}", request.getTitle());

        // Validation : si salaireMin et salaireMax existent, min <= max
        if (request.getSalaryMin() != null && request.getSalaryMax() != null
                && request.getSalaryMin().compareTo(request.getSalaryMax()) > 0) {
            throw new IllegalArgumentException(
                    "Le salaire minimum doit être inférieur ou égal au salaire maximum."
            );
        }

        JobOffer offer = JobOffer.builder()
                .title(request.getTitle())
                .company(request.getCompany())
                .location(request.getLocation())
                .sector(request.getSector())
                .contractType(request.getContractType())
                .salaryMin(request.getSalaryMin())
                .salaryMax(request.getSalaryMax())
                .description(request.getDescription())
                .requirements(request.getRequirements())
                .remote(request.getRemote() != null ? request.getRemote() : false)
                .url(request.getUrl())
                .source(request.getSource())
                .isActive(true)
                .build();

        JobOffer saved = repository.save(offer);
        log.info("Offre créée avec ID : {}", saved.getId());

        return JobOfferResponse.fromEntity(saved);
    }

    @Transactional(readOnly = true)
    public List<JobOfferResponse> findAll() {
        return repository.findAll().stream()
                .map(JobOfferResponse::fromEntity)
                .toList();
    }

    @Transactional(readOnly = true)
    public JobOfferResponse findById(Long id) {
        JobOffer offer = repository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException(
                        "Offre introuvable avec l'ID : " + id
                ));
        return JobOfferResponse.fromEntity(offer);
    }


    @Transactional(readOnly = true)
    public List<JobOfferResponse> findBySector(String sector) {
        return repository.findBySector(sector).stream()
                .map(JobOfferResponse::fromEntity)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<JobOfferResponse> findByLocation(String location) {
        return repository.findByLocation(location).stream()
                .map(JobOfferResponse::fromEntity)
                .toList();
    }
    @Transactional(readOnly = true)
    public List<JobOfferResponse> findByContractType(ContractType contractType) {
        return repository.findByContractType(contractType).stream()
                .map(JobOfferResponse::fromEntity)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<JobOfferResponse> findActiveOffers() {
        return repository.findByIsActiveTrue().stream()
                .map(JobOfferResponse::fromEntity)
                .toList();
    }
    @Transactional(readOnly = true)
    public List<JobOfferResponse> findRemoteOffers() {
        return repository.findByRemoteTrue().stream()
                .map(JobOfferResponse::fromEntity)
                .toList();
    }


    public JobOfferResponse update(Long id, JobOfferRequest request) {
        log.info("Mise à jour de l'offre ID : {}", id);

        JobOffer existing = repository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException(
                        "Offre introuvable avec l'ID : " + id
                ));

        existing.setTitle(request.getTitle());
        existing.setCompany(request.getCompany());
        existing.setLocation(request.getLocation());
        existing.setSector(request.getSector());
        existing.setContractType(request.getContractType());
        existing.setSalaryMin(request.getSalaryMin());
        existing.setSalaryMax(request.getSalaryMax());
        existing.setDescription(request.getDescription());
        existing.setRequirements(request.getRequirements());
        existing.setRemote(request.getRemote() != null ? request.getRemote() : false);
        existing.setUrl(request.getUrl());
        existing.setSource(request.getSource());

        JobOffer updated = repository.save(existing);
        log.info("Offre mise à jour");

        return JobOfferResponse.fromEntity(updated);
    }

    public void delete(Long id) {
        log.info("Suppression de l'offre ID : {}", id);

        if (!repository.existsById(id)) {
            throw new IllegalArgumentException("Offre introuvable avec l'ID : " + id);
        }

        repository.deleteById(id);
        log.info("Offre supprimée");
    }

    public JobOfferResponse archive(Long id) {
        log.info("Archivage de l'offre ID : {}", id);

        JobOffer offer = repository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException(
                        "Offre introuvable avec l'ID : " + id
                ));

        offer.setIsActive(false);
        JobOffer saved = repository.save(offer);
        log.info("Offre archivée");

        return JobOfferResponse.fromEntity(saved);
    }
}