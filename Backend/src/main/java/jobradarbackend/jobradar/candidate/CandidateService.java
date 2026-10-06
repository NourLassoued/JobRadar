package jobradarbackend.jobradar.candidate;

import jobradarbackend.jobradar.candidate.dto.CandidateRequest;
import jobradarbackend.jobradar.candidate.dto.CandidateResponse;
import jobradarbackend.jobradar.candidate.language.LanguageCatalog;
import jobradarbackend.jobradar.config.SupabaseStorageClient;
import jobradarbackend.jobradar.user.User;
import jobradarbackend.jobradar.user.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Toutes les méthodes sont transactionnelles : CandidateResponse.fromEntity()
 * lit la collection LAZY des langues, elle doit donc être appelée dans la transaction.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@Transactional
public class CandidateService {

    private static final Set<String> IMAGE_TYPES = Set.of("image/jpeg", "image/png", "image/gif", "image/webp");
    private static final Set<String> CV_TYPES = Set.of(
            "application/pdf",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "text/plain");
    private static final Set<String> CV_EXTENSIONS = Set.of("pdf", "doc", "docx", "txt");

    private final CandidateRepository repository;
    private final SupabaseStorageClient supabaseStorageClient;
    private final UserRepository userRepository;
    private final LanguageCatalog languageCatalog;

    // ===== LECTURE (transactions en lecture seule) =====

    @Transactional(readOnly = true)
    public CandidateResponse findById(Long id) {
        log.info("Recherche du candidat ID : {}", id);
        return CandidateResponse.fromEntity(getOrThrow(id));
    }

    @Transactional(readOnly = true)
    public List<CandidateResponse> findAll() {
        log.info("Récupération de tous les candidats");
        return repository.findAll().stream().map(CandidateResponse::fromEntity).toList();
    }

    @Transactional(readOnly = true)
    public List<CandidateResponse> findActiveCandidates() {
        log.info("Récupération des candidats actifs");
        return repository.findByIsActiveTrue().stream().map(CandidateResponse::fromEntity).toList();
    }

    @Transactional(readOnly = true)
    public List<CandidateResponse> findBySector(SectorType sector) {
        log.info("Recherche des candidats par secteur : {}", sector);
        return repository.findBySector(sector).stream().map(CandidateResponse::fromEntity).toList();
    }

    @Transactional(readOnly = true)
    public List<CandidateResponse> findByCity(String city) {
        log.info("Recherche des candidats par ville : {}", city);
        return repository.findByCity(city).stream().map(CandidateResponse::fromEntity).toList();
    }

    // ===== CRÉATION =====

    public CandidateResponse create(CandidateRequest request) {
        String email = normalizeEmail(request.getEmail());
        log.info("Création d'un nouveau candidat : {}", email);

        if (repository.existsByEmail(email)) {
            throw new IllegalArgumentException("Cet email est déjà utilisé.");
        }

        Candidate candidate = Candidate.builder()
                .firstName(request.getFirstName())
                .lastName(request.getLastName())
                .email(email)
                .phoneNumber(request.getPhoneNumber())
                .city(request.getCity())
                .sector(request.getSector())
                .yearsOfExperience(request.getYearsOfExperience())
                .skills(request.getSkills())
                .bio(request.getBio())
                .expectedSalary(request.getExpectedSalary())
                .remotePreference(Boolean.TRUE.equals(request.getRemotePreference()))
                .linkedinUrl(request.getLinkedinUrl())
                .isActive(true)
                .build();

        applyLanguages(candidate, request);

        Candidate saved = repository.save(candidate);
        log.info("Candidat créé avec succès ID : {}", saved.getId());
        return CandidateResponse.fromEntity(saved);
    }

    // ===== MISE À JOUR =====

    public CandidateResponse update(Long id, CandidateRequest request) {
        log.info("Mise à jour du candidat ID : {}", id);
        Candidate candidate = getOrThrow(id);

        candidate.setFirstName(request.getFirstName());
        candidate.setLastName(request.getLastName());
        candidate.setEmail(normalizeEmail(request.getEmail()));
        candidate.setPhoneNumber(request.getPhoneNumber());
        candidate.setCity(request.getCity());
        candidate.setSector(request.getSector());
        candidate.setYearsOfExperience(request.getYearsOfExperience());
        candidate.setSkills(request.getSkills());
        candidate.setBio(request.getBio());
        candidate.setExpectedSalary(request.getExpectedSalary());
        candidate.setRemotePreference(Boolean.TRUE.equals(request.getRemotePreference()));
        candidate.setLinkedinUrl(request.getLinkedinUrl());

        applyLanguages(candidate, request);

        Candidate updated = repository.save(candidate);
        return CandidateResponse.fromEntity(updated);
    }

    /**
     * Langues : null = ne pas toucher ; liste (même vide) = remplacer.
     * Le catalogue retire les codes inconnus et les doublons, et limite à 10 langues.
     */
    private void applyLanguages(Candidate candidate, CandidateRequest request) {
        if (request.getLanguages() == null) return;

        if (candidate.getLanguages() == null) {
            // Sécurité si @Builder.Default n'est pas présent sur le champ de l'entité
            candidate.setLanguages(new ArrayList<>());
        }
        candidate.getLanguages().clear();
        candidate.getLanguages().addAll(languageCatalog.sanitize(request.getLanguages()));
        log.info("Langues mises à jour pour le candidat : {} langue(s)", candidate.getLanguages().size());
    }

    // ===== PHOTO DE PROFIL (SUPABASE) =====

    public CandidateResponse uploadProfileImage(Long id, MultipartFile file) {
        log.info("Upload d'image de profil pour candidat ID : {} vers Supabase", id);
        Candidate candidate = getOrThrow(id);
        validateImage(file);

        try {
            String imageUrl = supabaseStorageClient.uploadFile("profiles", file);
            log.info("Image uploadée vers Supabase: {}", imageUrl);

            if (hasText(candidate.getProfileImageUrl())) {
                deleteOldImage(candidate.getProfileImageUrl());
            }
            candidate.setProfileImageUrl(imageUrl);

            Candidate updated = repository.save(candidate);
            log.info("Image de profil mise à jour pour candidat ID : {}", id);
            return CandidateResponse.fromEntity(updated);

        } catch (IOException e) {
            log.error("Erreur lors de l'upload de l'image : {}", e.getMessage());
            throw new RuntimeException("Erreur lors de l'upload de l'image : " + e.getMessage(), e);
        }
    }

    // ===== CV (SUPABASE) =====

    public CandidateResponse uploadCV(Long id, MultipartFile file) {
        log.info("Upload de CV pour candidat ID : {} vers Supabase", id);
        Candidate candidate = getOrThrow(id);
        validateCV(file);

        try {
            String cvUrl = supabaseStorageClient.uploadFile("cvs", file);
            log.info("CV uploadé vers Supabase: {}", cvUrl);

            if (hasText(candidate.getCvUrl())) {
                deleteOldCV(candidate.getCvUrl());
            }
            candidate.setCvUrl(cvUrl);

            Candidate updated = repository.save(candidate);
            log.info("CV mis à jour pour candidat ID : {}", id);
            return CandidateResponse.fromEntity(updated);

        } catch (IOException e) {
            log.error("Erreur lors de l'upload du CV : {}", e.getMessage());
            throw new RuntimeException("Erreur lors de l'upload du CV : " + e.getMessage(), e);
        }
    }

    // ===== IMAGE + CV ENSEMBLE =====

    public CandidateResponse uploadMediaFiles(Long id, MultipartFile imageFile, MultipartFile cvFile) {
        log.info("Upload image + CV pour candidat ID : {}", id);
        Candidate candidate = getOrThrow(id);

        try {
            if (imageFile != null && !imageFile.isEmpty()) {
                validateImage(imageFile);
                String imageUrl = supabaseStorageClient.uploadFile("profiles", imageFile);
                if (hasText(candidate.getProfileImageUrl())) {
                    deleteOldImage(candidate.getProfileImageUrl());
                }
                candidate.setProfileImageUrl(imageUrl);
                log.info("Image uploadée: {}", imageUrl);
            }

            if (cvFile != null && !cvFile.isEmpty()) {
                validateCV(cvFile);
                String cvUrl = supabaseStorageClient.uploadFile("cvs", cvFile);
                if (hasText(candidate.getCvUrl())) {
                    deleteOldCV(candidate.getCvUrl());
                }
                candidate.setCvUrl(cvUrl);
                log.info("CV uploadé: {}", cvUrl);
            }

            Candidate updated = repository.save(candidate);
            log.info("Fichiers media mis à jour pour candidat ID : {}", id);
            return CandidateResponse.fromEntity(updated);

        } catch (IOException e) {
            log.error("Erreur lors de l'upload des fichiers media : {}", e.getMessage());
            throw new RuntimeException("Erreur lors de l'upload: " + e.getMessage(), e);
        }
    }

    // ===== VALIDATIONS =====

    private void validateImage(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Le fichier image est vide.");
        }
        if (file.getSize() > 5 * 1024 * 1024) {
            throw new IllegalArgumentException("L'image dépasse 5 Mo.");
        }
        if (!IMAGE_TYPES.contains(file.getContentType())) {
            throw new IllegalArgumentException("Type d'image non autorisé (JPEG, PNG, GIF, WebP acceptés).");
        }
    }

    private void validateCV(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Le fichier CV est vide.");
        }
        if (file.getSize() > 10 * 1024 * 1024) {
            throw new IllegalArgumentException("Le CV dépasse 10 Mo.");
        }

        boolean allowed = CV_TYPES.contains(file.getContentType())
                || CV_EXTENSIONS.contains(getFileExtension(file.getOriginalFilename()));

        if (!allowed) {
            throw new IllegalArgumentException("Type de CV non autorisé (PDF, DOCX, DOC, TXT acceptés).");
        }
    }

    // ===== UTILITAIRES =====

    private Candidate getOrThrow(Long id) {
        return repository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Candidat introuvable avec l'ID : " + id));
    }

    private String normalizeEmail(String email) {
        return email == null ? null : email.trim().toLowerCase(Locale.ROOT);
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private String getFileExtension(String fileName) {
        if (fileName == null || !fileName.contains(".")) return "";
        return fileName.substring(fileName.lastIndexOf('.') + 1).toLowerCase(Locale.ROOT);
    }

    private void deleteOldImage(String imageUrl) {
        try {
            String fileName = supabaseStorageClient.extractFileNameFromUrl(imageUrl);
            if (fileName != null) {
                supabaseStorageClient.deleteFile("profiles", fileName);
                log.info("Ancienne image supprimée");
            }
        } catch (Exception e) {
            log.warn("Impossible de supprimer l'ancienne image: {}", e.getMessage());
        }
    }

    private void deleteOldCV(String cvUrl) {
        try {
            String fileName = supabaseStorageClient.extractFileNameFromUrl(cvUrl);
            if (fileName != null) {
                supabaseStorageClient.deleteFile("cvs", fileName);
                log.info("Ancien CV supprimé");
            }
        } catch (Exception e) {
            log.warn("Impossible de supprimer l'ancien CV: {}", e.getMessage());
        }
    }

    // ===== SUPPRESSION / ARCHIVAGE =====

    public void delete(Long id) {
        log.info("Suppression du candidat ID : {}", id);
        Candidate candidate = getOrThrow(id);

        if (hasText(candidate.getProfileImageUrl())) deleteOldImage(candidate.getProfileImageUrl());
        if (hasText(candidate.getCvUrl())) deleteOldCV(candidate.getCvUrl());

        // Les langues (candidate_languages) sont supprimées avec le candidat (@ElementCollection)
        repository.delete(candidate);
        log.info("Candidat supprimé avec succès ID : {}", id);
    }

    public CandidateResponse archive(Long id) {
        log.info("Archivage du candidat ID : {}", id);
        Candidate candidate = getOrThrow(id);
        candidate.setIsActive(false);
        Candidate archived = repository.save(candidate);
        log.info("Candidat archivé avec succès ID : {}", id);
        return CandidateResponse.fromEntity(archived);
    }

    public void deleteUser(Long userId) {
        log.info("Suppression de l'utilisateur ID : {}", userId);
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("Utilisateur introuvable"));

        repository.findByUserId(userId).ifPresent(candidate -> {
            if (hasText(candidate.getProfileImageUrl())) deleteOldImage(candidate.getProfileImageUrl());
            if (hasText(candidate.getCvUrl())) deleteOldCV(candidate.getCvUrl());
            repository.delete(candidate);
            log.info("Candidat supprimé pour l'utilisateur : {}", userId);
        });

        userRepository.delete(user);
        log.info("Utilisateur supprimé : {}", user.getEmail());
    }

    public void deleteCurrentUser(String email) {
        log.info("Suppression de l'utilisateur courant : {}", email);
        User user = userRepository.findByEmail(normalizeEmail(email))
                .orElseThrow(() -> new IllegalArgumentException("Utilisateur introuvable"));
        deleteUser(user.getId());
    }
}