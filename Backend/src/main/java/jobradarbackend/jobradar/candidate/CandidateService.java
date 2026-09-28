package jobradarbackend.jobradar.candidate;

import jobradarbackend.jobradar.candidate.dto.CandidateRequest;
import jobradarbackend.jobradar.candidate.dto.CandidateResponse;
import jobradarbackend.jobradar.config.SupabaseStorageClient;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.stream.Collectors;


@Slf4j
@Service
@RequiredArgsConstructor
@Transactional
public class CandidateService {

    private final CandidateRepository repository;

    private final SupabaseStorageClient supabaseStorageClient;

    // ===== FIND METHODS =====
    public CandidateResponse findById(Long id) {
        log.info("Recherche du candidat ID : {}", id);
        Candidate candidate = repository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException(
                        "Candidat introuvable avec l'ID : " + id
                ));
        return CandidateResponse.fromEntity(candidate);
    }

    public List<CandidateResponse> findAll() {
        log.info("Récupération de tous les candidats");
        return repository.findAll().stream()
                .map(CandidateResponse::fromEntity)
                .collect(Collectors.toList());
    }

    public List<CandidateResponse> findActiveCandidates() {
        log.info("Récupération des candidats actifs");
        return repository.findByIsActiveTrue().stream()
                .map(CandidateResponse::fromEntity)
                .collect(Collectors.toList());
    }

    public List<CandidateResponse> findBySector(SectorType sector) {
        log.info("Recherche des candidats par secteur : {}", sector);
        return repository.findBySector(sector).stream()
                .map(CandidateResponse::fromEntity)
                .collect(Collectors.toList());
    }

    public List<CandidateResponse> findByCity(String city) {
        log.info("Recherche des candidats par ville : {}", city);
        return repository.findByCity(city).stream()
                .map(CandidateResponse::fromEntity)
                .collect(Collectors.toList());
    }

    // ===== CREATE METHOD =====
    public CandidateResponse create(CandidateRequest request) {
        log.info("Création d'un nouveau candidat : {}", request.getEmail());

        if (repository.existsByEmail(request.getEmail())) {
            throw new IllegalArgumentException("Cet email est déjà utilisé.");
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
                .isActive(true)
                .build();

        Candidate saved = repository.save(candidate);
        log.info("Candidat créé avec succès ID : {}", saved.getId());

        return CandidateResponse.fromEntity(saved);
    }

    // ===== UPDATE METHOD =====
    public CandidateResponse update(Long id, CandidateRequest request) {
        log.info("Mise à jour du candidat ID : {}", id);

        // 1. Récupère l'entity existante
        Candidate candidate = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Candidat non trouvé"));

        // 2. Map les données du DTO à l'entity
        candidate.setFirstName(request.getFirstName());
        candidate.setLastName(request.getLastName());
        candidate.setEmail(request.getEmail());
        candidate.setPhoneNumber(request.getPhoneNumber());
        candidate.setCity(request.getCity());
        candidate.setSector(request.getSector());
        candidate.setYearsOfExperience(request.getYearsOfExperience());
        candidate.setSkills(request.getSkills());
        candidate.setBio(request.getBio());
        candidate.setExpectedSalary(request.getExpectedSalary());
        candidate.setRemotePreference(request.getRemotePreference());
        candidate.setLinkedinUrl(request.getLinkedinUrl());

        // 3. Sauvegarde
        Candidate updated = repository.save(candidate);

        // 4. Retourne le DTO avec fromEntity() (qui inclut profileImageUrl)
        return CandidateResponse.fromEntity(updated);
    }

    // ===== NEW: UPLOAD PROFILE IMAGE (SUPABASE) =====
    public CandidateResponse uploadProfileImage(Long id, MultipartFile file) {
        log.info("Upload d'image de profil pour candidat ID : {} vers Supabase", id);

        Candidate candidate = repository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException(
                        "Candidat introuvable avec l'ID : " + id
                ));

        validateImage(file);

        try {
            // 1. Upload vers Supabase Storage (bucket: profiles)
            String imageUrl = supabaseStorageClient.uploadFile("profiles", file);
            log.info("Image uploadée vers Supabase: {}", imageUrl);

            // 2. Supprimer l'ancienne image si elle existe
            if (candidate.getProfileImageUrl() != null && !candidate.getProfileImageUrl().isEmpty()) {
                deleteOldImage(candidate.getProfileImageUrl());
            }

            // 3. Mettre à jour le candidat
            candidate.setProfileImageUrl(imageUrl);

            // 4. Sauvegarder
            Candidate updated = repository.save(candidate);
            log.info("Image de profil mise à jour pour candidat ID : {}", id);

            return CandidateResponse.fromEntity(updated);

        } catch (IOException e) {
            log.error("Erreur lors de l'upload de l'image : {}", e.getMessage());
            throw new RuntimeException("Erreur lors de l'upload de l'image : " + e.getMessage());
        }
    }

    // ===== NEW: UPLOAD CV (SUPABASE) =====
    public CandidateResponse uploadCV(Long id, MultipartFile file) {
        log.info("Upload de CV pour candidat ID : {} vers Supabase", id);

        Candidate candidate = repository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException(
                        "Candidat introuvable avec l'ID : " + id
                ));

        validateCV(file);

        try {
            // 1. Upload vers Supabase Storage (bucket: cvs)
            String cvUrl = supabaseStorageClient.uploadFile("cvs", file);
            log.info("CV uploadé vers Supabase: {}", cvUrl);

            // 2. Supprimer l'ancien CV si existe
            if (candidate.getCvUrl() != null && !candidate.getCvUrl().isEmpty()) {
                deleteOldCV(candidate.getCvUrl());
            }

            // 3. Mettre à jour le candidat
            candidate.setCvUrl(cvUrl);

            // 4. Sauvegarder
            Candidate updated = repository.save(candidate);
            log.info("CV mis à jour pour candidat ID : {}", id);

            return CandidateResponse.fromEntity(updated);

        } catch (IOException e) {
            log.error("Erreur lors de l'upload du CV : {}", e.getMessage());
            throw new RuntimeException("Erreur lors de l'upload du CV : " + e.getMessage());
        }
    }

    // ===== NEW: UPLOAD IMAGE + CV ENSEMBLE =====
    public CandidateResponse uploadMediaFiles(Long id, MultipartFile imageFile, MultipartFile cvFile) {
        log.info("Upload image + CV pour candidat ID : {}", id);

        Candidate candidate = repository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException(
                        "Candidat introuvable avec l'ID : " + id
                ));

        try {
            // 1. Upload image si fournie
            if (imageFile != null && !imageFile.isEmpty()) {
                validateImage(imageFile);
                String imageUrl = supabaseStorageClient.uploadFile("profiles", imageFile);

                if (candidate.getProfileImageUrl() != null) {
                    deleteOldImage(candidate.getProfileImageUrl());
                }

                candidate.setProfileImageUrl(imageUrl);
                log.info("Image uploadée: {}", imageUrl);
            }

            // 2. Upload CV si fourni
            if (cvFile != null && !cvFile.isEmpty()) {
                validateCV(cvFile);
                String cvUrl = supabaseStorageClient.uploadFile("cvs", cvFile);

                if (candidate.getCvUrl() != null) {
                    deleteOldCV(candidate.getCvUrl());
                }

                candidate.setCvUrl(cvUrl);
                log.info("CV uploadé: {}", cvUrl);
            }

            // 3. Sauvegarder
            Candidate updated = repository.save(candidate);
            log.info("Fichiers media mis à jour pour candidat ID : {}", id);

            return CandidateResponse.fromEntity(updated);

        } catch (IOException e) {
            log.error("Erreur lors de l'upload des fichiers media : {}", e.getMessage());
            throw new RuntimeException("Erreur lors de l'upload: " + e.getMessage());
        }
    }

    // ===== VALIDATE IMAGE =====
    private void validateImage(MultipartFile file) {
        if (file.isEmpty()) {
            throw new IllegalArgumentException("Le fichier image est vide.");
        }

        if (file.getSize() > 5 * 1024 * 1024) {
            throw new IllegalArgumentException("L'image dépasse 5MB.");
        }

        String contentType = file.getContentType();
        if (contentType == null || !contentType.startsWith("image/")) {
            throw new IllegalArgumentException("Le fichier n'est pas une image valide.");
        }

        String[] allowedTypes = {"image/jpeg", "image/png", "image/gif", "image/webp"};
        boolean isAllowed = false;
        for (String type : allowedTypes) {
            if (type.equals(contentType)) {
                isAllowed = true;
                break;
            }
        }

        if (!isAllowed) {
            throw new IllegalArgumentException("Type d'image non autorisé (JPEG, PNG, GIF, WebP acceptés).");
        }
    }

    // ===== VALIDATE CV =====
    private void validateCV(MultipartFile file) {
        if (file.isEmpty()) {
            throw new IllegalArgumentException("Le fichier CV est vide.");
        }

        if (file.getSize() > 10 * 1024 * 1024) {
            throw new IllegalArgumentException("Le CV dépasse 10MB.");
        }

        String contentType = file.getContentType();
        String fileName = file.getOriginalFilename();

        // Autoriser PDF, Word, texte
        String[] allowedTypes = {
                "application/pdf",
                "application/msword",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                "text/plain"
        };

        boolean isAllowed = false;
        if (contentType != null) {
            for (String type : allowedTypes) {
                if (type.equals(contentType)) {
                    isAllowed = true;
                    break;
                }
            }
        }

        // Vérifier aussi l'extension
        if (!isAllowed && fileName != null) {
            String[] allowedExtensions = {"pdf", "doc", "docx", "txt"};
            String extension = getFileExtension(fileName);
            for (String ext : allowedExtensions) {
                if (ext.equals(extension)) {
                    isAllowed = true;
                    break;
                }
            }
        }

        if (!isAllowed) {
            throw new IllegalArgumentException("Type de CV non autorisé (PDF, DOCX, DOC, TXT acceptés).");
        }
    }

    // ===== HELPER: GET FILE EXTENSION =====
    private String getFileExtension(String fileName) {
        if (fileName == null || !fileName.contains(".")) {
            return "";
        }
        return fileName.substring(fileName.lastIndexOf(".") + 1).toLowerCase();
    }

    // ===== DELETE OLD IMAGE =====
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

    // ===== DELETE OLD CV =====
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

    // ===== DELETE CANDIDATE =====
    public void delete(Long id) {
        log.info("Suppression du candidat ID : {}", id);

        Candidate candidate = repository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException(
                        "Candidat introuvable avec l'ID : " + id
                ));

        if (candidate.getProfileImageUrl() != null && !candidate.getProfileImageUrl().isEmpty()) {
            deleteOldImage(candidate.getProfileImageUrl());
        }

        if (candidate.getCvUrl() != null && !candidate.getCvUrl().isEmpty()) {
            deleteOldCV(candidate.getCvUrl());
        }

        repository.deleteById(id);
        log.info("Candidat supprimé avec succès ID : {}", id);
    }

    // ===== ARCHIVE =====
    public CandidateResponse archive(Long id) {
        log.info("Archivage du candidat ID : {}", id);

        Candidate candidate = repository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException(
                        "Candidat introuvable avec l'ID : " + id
                ));

        candidate.setIsActive(false);
        Candidate archived = repository.save(candidate);
        log.info("Candidat archivé avec succès ID : {}", id);

        return CandidateResponse.fromEntity(archived);
    }
}
