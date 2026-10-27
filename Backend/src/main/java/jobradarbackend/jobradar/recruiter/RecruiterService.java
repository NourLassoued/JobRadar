package jobradarbackend.jobradar.recruiter;

import jobradarbackend.jobradar.applications.Application;
import jobradarbackend.jobradar.applications.ApplicationRepository;
import jobradarbackend.jobradar.applications.ApplicationStatus;
import jobradarbackend.jobradar.candidate.Candidate;
import jobradarbackend.jobradar.cv.CandidateCv;
import jobradarbackend.jobradar.documents.CoverLetterDocument;
import jobradarbackend.jobradar.joboffer.JobOffer;
import jobradarbackend.jobradar.joboffer.JobOfferRepository;
import jobradarbackend.jobradar.matching.MatchResult;
import jobradarbackend.jobradar.matching.MatchingService;
import jobradarbackend.jobradar.recruiter.RecruiterDtos.ApplicantResponse;
import jobradarbackend.jobradar.recruiter.RecruiterDtos.CompanyRequest;
import jobradarbackend.jobradar.recruiter.RecruiterDtos.CompanyResponse;
import jobradarbackend.jobradar.recruiter.RecruiterDtos.JobPostRequest;
import jobradarbackend.jobradar.recruiter.RecruiterDtos.RecruiterJobResponse;
import jobradarbackend.jobradar.user.Role;
import jobradarbackend.jobradar.user.User;
import jobradarbackend.jobradar.user.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.security.Principal;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

/**
 * Espace recruteur : profil entreprise, offres publiées et candidatures reçues.
 *
 * Règle de sécurité : un recruteur ne voit et ne modifie QUE les offres de son entreprise,
 * et seulement les candidatures envoyées à ces offres. Une offre d'une autre entreprise
 * répond 404 (on ne révèle pas qu'elle existe).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RecruiterService {

    /** Candidatures visibles par le recruteur : celles réellement envoyées (pas les offres « sauvegardées ») */
    static final Set<ApplicationStatus> VISIBLE = EnumSet.of(
            ApplicationStatus.APPLIED, ApplicationStatus.INTERVIEW, ApplicationStatus.OFFER, ApplicationStatus.REJECTED);

    /** Décisions que le recruteur peut prendre sur une candidature */
    static final Set<ApplicationStatus> RECRUITER_DECISIONS = EnumSet.of(
            ApplicationStatus.INTERVIEW, ApplicationStatus.OFFER, ApplicationStatus.REJECTED);

    private final UserRepository userRepository;
    private final CompanyRepository companyRepository;
    private final JobOfferRepository jobOfferRepository;
    private final ApplicationRepository applicationRepository;
    private final MatchingService matchingService;
    private final RecruiterJobMapper mapper;

    // ── Profil entreprise ────────────────────────────────────

    @Transactional(readOnly = true)
    public CompanyResponse getCompany(Principal principal) {
        Company company = companyRepository.findByOwnerId(currentUser(principal).getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Aucun profil entreprise."));
        return toResponse(company);
    }

    /** Crée le profil entreprise au premier appel, le met à jour ensuite */
    @Transactional
    public CompanyResponse saveCompany(Principal principal, CompanyRequest req) {
        User user = currentUser(principal);
        Company company = companyRepository.findByOwnerId(user.getId())
                .orElseGet(() -> Company.builder().owner(user).build());

        company.setName(req.name().strip());
        company.setDescription(blankToNull(req.description()));
        company.setSector(req.sector());
        company.setSize(req.size());
        company.setCity(blankToNull(req.city()));
        company.setWebsite(blankToNull(req.website()));
        company.setLinkedinUrl(blankToNull(req.linkedinUrl()));
        company.setLogoUrl(blankToNull(req.logoUrl()));
        company.setContactEmail(blankToNull(req.contactEmail()));

        Company saved = companyRepository.save(company);

        // Créer une entreprise fait de l'utilisateur un recruteur (un ADMIN garde son rôle)
        if (user.getRole() != Role.RECRUITER && user.getRole() != Role.ADMIN) {
            user.setRole(Role.RECRUITER);
            userRepository.save(user);
            log.info("Utilisateur {} passé au rôle RECRUITER", user.getId());
        }
        log.info("Profil entreprise enregistré : {} (utilisateur {})", saved.getName(), user.getId());
        return toResponse(saved);
    }

    // ── Offres ───────────────────────────────────────────────

    @Transactional
    public RecruiterJobResponse createJob(Principal principal, JobPostRequest req) {
        Company company = requireCompany(principal);
        checkSalary(req);

        JobOffer offer = new JobOffer();
        mapper.apply(req, company, offer);
        JobOffer saved = jobOfferRepository.save(offer);

        log.info("Offre publiée par {} : {} (id {})", company.getName(), saved.getTitle(), saved.getId());
        return mapper.toResponse(saved, 0);
    }

    @Transactional(readOnly = true)
    public List<RecruiterJobResponse> listJobs(Principal principal) {
        Company company = requireCompany(principal);
        return jobOfferRepository.findByPublisherIdOrderByCreatedAtDesc(company.getId()).stream()
                .map(o -> mapper.toResponse(o, applicantsCount(o)))
                .toList();
    }

    @Transactional(readOnly = true)
    public RecruiterJobResponse getJob(Principal principal, Long jobId) {
        JobOffer offer = ownedOffer(requireCompany(principal), jobId);
        return mapper.toResponse(offer, applicantsCount(offer));
    }

    @Transactional
    public RecruiterJobResponse updateJob(Principal principal, Long jobId, JobPostRequest req) {
        Company company = requireCompany(principal);
        checkSalary(req);
        JobOffer offer = ownedOffer(company, jobId);
        mapper.apply(req, company, offer);
        return mapper.toResponse(jobOfferRepository.save(offer), applicantsCount(offer));
    }

    /** Fermer une offre la retire des recherches des candidats sans supprimer les candidatures */
    @Transactional
    public RecruiterJobResponse setJobActive(Principal principal, Long jobId, boolean active) {
        JobOffer offer = ownedOffer(requireCompany(principal), jobId);
        offer.setIsActive(active);
        return mapper.toResponse(jobOfferRepository.save(offer), applicantsCount(offer));
    }

    // ── Candidats ────────────────────────────────────────────

    /** Candidatures reçues pour une offre, de la plus compatible à la moins compatible */
    @Transactional(readOnly = true)
    public List<ApplicantResponse> listApplicants(Principal principal, Long jobId) {
        JobOffer offer = ownedOffer(requireCompany(principal), jobId);
        return applicationRepository.findByJobOfferIdAndStatusInOrderByCreatedAtDesc(offer.getId(), VISIBLE).stream()
                .map(a -> toApplicant(a, offer))
                .sorted(Comparator.comparing(ApplicantResponse::matchScore, Comparator.nullsLast(Comparator.reverseOrder())))
                .toList();
    }

    /** Entretien, proposition ou refus : la carte du candidat change de colonne dans son Kanban */
    @Transactional
    public ApplicantResponse updateApplicantStatus(Principal principal, Long applicationId, ApplicationStatus status) {
        if (!RECRUITER_DECISIONS.contains(status)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Statut non autorisé. Valeurs possibles : INTERVIEW, OFFER, REJECTED.");
        }
        Company company = requireCompany(principal);
        Application application = applicationRepository.findById(applicationId)
                .filter(a -> a.getJobOffer() != null && isOwnedBy(a.getJobOffer(), company))
                .filter(a -> VISIBLE.contains(a.getStatus()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Candidature introuvable."));

        application.moveTo(status);
        Application saved = applicationRepository.save(application);
        log.info("Candidature {} : {} par {}", applicationId, status, company.getName());
        return toApplicant(saved, saved.getJobOffer());
    }

    // ── Outils internes ──────────────────────────────────────

    /** Identifiant du compte connecté (sert à nommer le fichier du logo) */
    public Long currentUserId(Principal principal) {
        return currentUser(principal).getId();
    }

    private User currentUser(Principal principal) {
        if (principal == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Connexion requise.");
        return userRepository.findByEmail(principal.getName())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Utilisateur introuvable."));
    }

    private Company requireCompany(Principal principal) {
        return companyRepository.findByOwnerId(currentUser(principal).getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT,
                        "Créez d'abord le profil de votre entreprise."));
    }

    /** L'offre doit appartenir à l'entreprise du recruteur ; sinon 404 */
    private JobOffer ownedOffer(Company company, Long jobId) {
        return jobOfferRepository.findById(jobId)
                .filter(o -> isOwnedBy(o, company))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Offre introuvable."));
    }

    static boolean isOwnedBy(JobOffer offer, Company company) {
        return offer.getPublisher() != null && Objects.equals(offer.getPublisher().getId(), company.getId());
    }

    private void checkSalary(JobPostRequest req) {
        if (req.salaryMin() != null && req.salaryMax() != null && req.salaryMin() > req.salaryMax()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Le salaire minimum doit être inférieur ou égal au salaire maximum.");
        }
    }

    private long applicantsCount(JobOffer offer) {
        return applicationRepository.countByJobOfferIdAndStatusIn(offer.getId(), VISIBLE);
    }

    private CompanyResponse toResponse(Company c) {
        long activeJobs = jobOfferRepository.countByPublisherIdAndIsActiveTrue(c.getId());
        return new CompanyResponse(c.getId(), c.getName(), c.getDescription(), c.getSector(), c.getSize(), c.getCity(),
                c.getWebsite(), c.getLinkedinUrl(), c.getLogoUrl(), c.getContactEmail(), c.getCreatedAt(), activeJobs);
    }

    /** Score recalculé avec le profil actuel ; à défaut, celui enregistré au moment de la candidature */
    private ApplicantResponse toApplicant(Application a, JobOffer offer) {
        Candidate c = a.getCandidate();
        MatchResult match = null;
        try {
            match = matchingService.score(c, offer);
        } catch (RuntimeException e) {
            log.warn("Score indisponible pour la candidature {} : {}", a.getId(), e.getMessage());
        }

        // CV choisi dans le formulaire de candidature (sinon : CV du profil)
        CandidateCv cv = a.getCv();
        String cvUrl = cv != null ? cv.getFileUrl() : c.getCvUrl();
        String cvName = cv != null ? firstNonBlank(cv.getTitle(), cv.getFileName()) : null;

        // Lettre de motivation choisie dans le formulaire de candidature
        CoverLetterDocument letter = a.getCoverLetterDocument();
        String letterUrl = letter != null ? letter.getFileUrl() : null;
        String letterName = letter != null ? firstNonBlank(letter.getTitle(), letter.getFileName()) : null;

        return new ApplicantResponse(
                a.getId(),
                c.getId(),
                c.getFirstName(),
                c.getLastName(),
                c.getEmail(),
                c.getPhoneNumber(),
                c.getCity(),
                c.getProfileImageUrl(),
                c.getLinkedinUrl(),
                c.getSector(),
                c.getYearsOfExperience(),
                c.getSkills() == null ? List.of() : List.copyOf(c.getSkills()),
                match != null ? Integer.valueOf(match.score()) : a.getMatchScore(),
                match != null ? match.matchedSkills() : List.of(),
                match != null ? match.missingSkills() : List.of(),
                a.getStatus(),
                a.getAppliedAt(),
                cvUrl,
                a.getCoverLetter(),
                cvName,
                letterUrl,
                letterName);
    }

    private static String firstNonBlank(String a, String b) {
        return a != null && !a.isBlank() ? a : b;
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.strip();
    }
}