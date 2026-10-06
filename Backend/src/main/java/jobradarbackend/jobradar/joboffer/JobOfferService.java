package jobradarbackend.jobradar.joboffer;

import jobradarbackend.jobradar.candidate.Candidate;
import jobradarbackend.jobradar.candidate.CandidateRepository;
import jobradarbackend.jobradar.candidate.SectorType;
import jobradarbackend.jobradar.joboffer.DtoJoboffer.JobOfferRequest;
import jobradarbackend.jobradar.joboffer.DtoJoboffer.JobOfferResponse;
import jobradarbackend.jobradar.user.User;
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
    private final CandidateRepository candidateRepository;      // ← AJOUTER


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
    public List<JobOfferResponse> findRecommendedOffers(Candidate candidate) {
        log.info("=== findRecommendedOffers START ===");

        // 1️⃣ Vérifier que candidate n'est pas null
        if (candidate == null) {
            log.warn(" Candidate est NULL → retourner toutes les offres");
            return findAll();
        }

        log.debug("Candidate trouvé: ID={}, email={}", candidate.getId(), candidate.getEmail());

        // 2️⃣ Récupérer le secteur
        SectorType sectorType = candidate.getSector();
        log.debug("Raw sector: {} (class: {})", sectorType,
                sectorType != null ? sectorType.getClass().getSimpleName() : "null");

        // 3️⃣ Vérifier que le secteur est renseigné
        if (sectorType == null) {
            log.warn(" Secteur de {} est NULL → retourner toutes les offres", candidate.getEmail());
            return findAll();
        }


        String sectorForSearch = getSectorForSearch(sectorType);

        log.debug("Sector converted for search: {} → {}", sectorType, sectorForSearch);

        // 5️⃣ Chercher les offres
        if (sectorForSearch == null || sectorForSearch.isBlank()) {
            log.warn("Cannot convert sector {} to search string", sectorType);
            return findAll();
        }

        log.info(" Searching offers for sector: {}", sectorForSearch);
        List<JobOfferResponse> offers = findBySector(sectorForSearch);

        log.info("Found {} offers for sector: {}", offers.size(), sectorForSearch);
        return offers;
    }

    private String getSectorForSearch(SectorType sectorType) {
        if (sectorType == null) {
            return null;
        }

        String enumName = sectorType.name();
        if (enumName != null && !enumName.isBlank()) {
            log.debug("Using enum name for search: {}", enumName);
            return enumName;
        }

        String keyword = sectorType.getSearchKeyword();
        log.debug("searchKeyword null, using keyword: {}", keyword);
        return keyword; }
    @Transactional(readOnly = true)
    public List<JobOfferResponse> findRecommendedOffersByEnumName(String enumName) {
        if (enumName == null || enumName.isBlank()) {
            return findAll();
        }
        log.debug("Recherche offres pour enum name: {}", enumName);
        return findBySector(enumName);
    }

    /**
     * Variant: Rechercher par keyword France Travail
     */
    @Transactional(readOnly = true)
    public List<JobOfferResponse> findRecommendedOffersByKeyword(String keyword) {
        if (keyword == null || keyword.isBlank()) {
            return findAll();
        }
        log.debug("Recherche offres pour keyword: {}", keyword);
        return findBySector(keyword);
    }

    /**
     * Variant: Si on veut juste le secteur en string au lieu de l'objet User
     */
    @Transactional(readOnly = true)
    public List<JobOfferResponse> findRecommendedOffersBySector(String userSector) {
        if (userSector != null && !userSector.isBlank()) {
            log.debug("Recherche offres pour secteur: {}", userSector);
            return findBySector(userSector);
        }

        log.debug("Secteur vide, retourner toutes les offres");
        return findAll();
    }

    // ═════════════════════════════════════════════════════════

    @Transactional(readOnly = true)
    public List<JobOfferResponse> findBySector(String sector) {
        log.debug("Recherche offres pour secteur: {}", sector);
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
    @Transactional(readOnly = true)
    public List<JobOffer> getOffersBySector(SectorType sectorType) {
        if (sectorType == null) {
            log.warn("⚠️ Secteur NULL → retour liste vide");
            return List.of();
        }

        String enumName = sectorType.name();  // "TECH", "HEALTH", etc
        log.info("🔍 Recherche offres par secteur enum: {}", enumName);

        List<JobOffer> offers = repository.findBySector(enumName);
        log.info("✅ Trouvé {} offres pour secteur: {}", offers.size(), enumName);

        return offers;
    }
    @Transactional(readOnly = true)
    public List<JobOfferResponse> getOffersBySectorAsResponses(SectorType sectorType) {
        if (sectorType == null) {
            log.warn("⚠️ Secteur NULL → retour liste vide");
            return List.of();
        }

        String enumName = sectorType.name();
        log.info("🔍 Recherche offres par secteur enum: {}", enumName);

        List<JobOfferResponse> offers = repository.findBySector(enumName).stream()
                .map(JobOfferResponse::fromEntity)
                .toList();

        log.info("✅ Trouvé {} offres pour secteur: {}", offers.size(), enumName);
        return offers;
    }
}