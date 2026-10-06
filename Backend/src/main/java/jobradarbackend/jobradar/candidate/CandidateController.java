package jobradarbackend.jobradar.candidate;

import jakarta.validation.Valid;
import jobradarbackend.jobradar.candidate.dto.CandidateRequest;
import jobradarbackend.jobradar.candidate.dto.CandidateResponse;
import jobradarbackend.jobradar.user.AuthService;
import jobradarbackend.jobradar.user.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@Slf4j
@RestController
@RequestMapping("/api/candidates")
@RequiredArgsConstructor
public class CandidateController {

    private final CandidateService service;
private  final AuthService authService;

    @PostMapping
    public ResponseEntity<CandidateResponse> create(@Valid @RequestBody CandidateRequest request) {
        log.info("POST /api/candidates - Create candidat");
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(request));
    }

    @GetMapping
    public ResponseEntity<List<CandidateResponse>> findAll(
            @RequestParam(required = false) SectorType sector,
            @RequestParam(required = false) String city) {
        log.info("GET /api/candidates - Sector: {}, City: {}", sector, city);

        if (sector != null) {
            return ResponseEntity.ok(service.findBySector(sector));
        }
        if (city != null) {
            return ResponseEntity.ok(service.findByCity(city));
        }
        return ResponseEntity.ok(service.findAll());
    }

    @GetMapping("/active")
    public ResponseEntity<List<CandidateResponse>> findActive() {
        log.info("GET /api/candidates/active");
        return ResponseEntity.ok(service.findActiveCandidates());
    }

    @GetMapping("/{id}")
    public ResponseEntity<CandidateResponse> findById(@PathVariable Long id) {
        log.info("GET /api/candidates/{}", id);
        return ResponseEntity.ok(service.findById(id));
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(
            @PathVariable Long id,
            @RequestBody CandidateRequest request) {  // ← SANS @Valid!

        log.info("🔍 [PUT /api/candidates/{}] - Request reçu", id);
        log.info("📥 Payload complet: {}", request);
        log.info("📥 firstName: {}", request.getFirstName());
        log.info("📥 lastName: {}", request.getLastName());
        log.info("📥 email: {}", request.getEmail());
        log.info("📥 profileImageUrl: {}", request.getProfileImageUrl());
        log.info("📥 cvUrl: {}", request.getCvUrl());

        try {
            // Validation manuelle avec logs
            if (request.getFirstName() == null || request.getFirstName().isBlank()) {
                log.error("❌ firstName est null ou vide");
                return ResponseEntity.badRequest().body("❌ firstName est obligatoire");
            }
            if (request.getLastName() == null || request.getLastName().isBlank()) {
                log.error("❌ lastName est null ou vide");
                return ResponseEntity.badRequest().body("❌ lastName est obligatoire");
            }
            if (request.getEmail() == null || request.getEmail().isBlank()) {
                log.error("❌ email est null ou vide");
                return ResponseEntity.badRequest().body("❌ email est obligatoire");
            }

            log.info("✅ Validation OK - Appel du service");
            CandidateResponse response = service.update(id, request);
            log.info("✅ PUT /api/candidates/{} - Update réussi", id);
            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("❌ Erreur lors de la mise à jour: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("❌ Erreur: " + e.getMessage());
        }
    }

            @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        log.info("DELETE /api/candidates/{}", id);
        service.delete(id);
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/{id}/archive")
    public ResponseEntity<CandidateResponse> archive(@PathVariable Long id) {
        log.info("PATCH /api/candidates/{}/archive", id);
        return ResponseEntity.ok(service.archive(id));
    }


    @PostMapping("/{id}/profile-image")
    public ResponseEntity<CandidateResponse> uploadProfileImage(
            @PathVariable Long id,
            @RequestParam("file") MultipartFile file) {
        log.info("POST /api/candidates/{}/profile-image - Upload image vers Supabase", id);

        if (file == null || file.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }

        try {
            CandidateResponse response = service.uploadProfileImage(id, file);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Erreur lors de l'upload d'image : {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .build();
        }
    }


    @PostMapping("/{id}/cv")
    public ResponseEntity<CandidateResponse> uploadCV(
            @PathVariable Long id,
            @RequestParam("file") MultipartFile file) {
        log.info("POST /api/candidates/{}/cv - Upload CV vers Supabase", id);

        if (file == null || file.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }

        try {
            CandidateResponse response = service.uploadCV(id, file);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Erreur lors de l'upload du CV : {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .build();
        }
    }


    @PostMapping("/{id}/media")
    public ResponseEntity<CandidateResponse> uploadMediaFiles(
            @PathVariable Long id,
            @RequestParam(value = "profileImage", required = false) MultipartFile profileImage,
            @RequestParam(value = "cv", required = false) MultipartFile cv) {
        log.info("POST /api/candidates/{}/media - Upload image + CV vers Supabase", id);

        if ((profileImage == null || profileImage.isEmpty()) &&
                (cv == null || cv.isEmpty())) {
            return ResponseEntity.badRequest().build();
        }

        try {
            CandidateResponse response = service.uploadMediaFiles(id, profileImage, cv);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Erreur lors de l'upload des fichiers media : {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .build();
        }
    }

    @PostMapping("/{id}/profile-complete")
    public ResponseEntity<CandidateResponse> updateProfileComplete(
            @PathVariable Long id,
            @RequestPart("request") CandidateRequest request,
            @RequestPart(value = "profileImage", required = false) MultipartFile profileImage,
            @RequestPart(value = "cv", required = false) MultipartFile cv) {
        log.info("POST /api/candidates/{}/profile-complete - Update + media", id);

        try {
            // 1. Update les données du candidat
            CandidateResponse response = service.update(id, request);

            // 2. Upload les fichiers media
            if (profileImage != null || cv != null) {
                response = service.uploadMediaFiles(id, profileImage, cv);
            }

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("Erreur lors de la mise à jour complète du profil : {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .build();
        }
    }

    @DeleteMapping("/{id}/profile-image")
    public ResponseEntity<Void> deleteProfileImage(@PathVariable Long id) {
        log.info("DELETE /api/candidates/{}/profile-image", id);
        // Logique à implémenter si nécessaire
        return ResponseEntity.noContent().build();
    }


    @DeleteMapping("/{id}/cv")
    public ResponseEntity<Void> deleteCV(@PathVariable Long id) {
        log.info("DELETE /api/candidates/{}/cv", id);
        // Logique à implémenter si nécessaire
        return ResponseEntity.noContent().build();
    }
// ==================== DELETE USER ====================

    @DeleteMapping("/delete/{userId}")
    public ResponseEntity<String> deleteUser(
            @PathVariable Long userId,
            @AuthenticationPrincipal UserDetails userDetails) {

        log.info("Delete user request from: {} for user: {}", userDetails.getUsername(), userId);

        try {
            // Vérifier que l'utilisateur supprime son propre compte
            User currentUser = authService.getUserByEmail(userDetails.getUsername());
            if (!currentUser.getId().equals(userId)) {
                log.warn("⚠️ User {} tried to delete account of user {}", userDetails.getUsername(), userId);
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body("You can only delete your own account");
            }

            service.deleteUser(userId);
            log.info("✅ User deleted: {}", userDetails.getUsername());

            return ResponseEntity.ok("User account deleted successfully");

        } catch (Exception e) {
            log.error("❌ Error deleting user: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body("Error deleting user: " + e.getMessage());
        }
    }

    @DeleteMapping("/delete-current")
    public ResponseEntity<String> deleteCurrentUser(
            @AuthenticationPrincipal UserDetails userDetails) {

        log.info("Delete current user request from: {}", userDetails.getUsername());

        try {
            service.deleteCurrentUser(userDetails.getUsername());
            log.info("✅ Current user deleted: {}", userDetails.getUsername());

            return ResponseEntity.ok("Your account has been deleted successfully");

        } catch (Exception e) {
            log.error("❌ Error deleting current user: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body("Error deleting account: " + e.getMessage());
        }
    }
    @DeleteMapping("/delete-test/{userId}")
    public ResponseEntity<String> deleteUserTest(@PathVariable Long userId) {
        log.info("🧪 DELETE TEST - Suppression utilisateur ID: {}", userId);
        try {
            service.deleteUser(userId);
            return ResponseEntity.ok().body("✅ User deleted successfully");
        } catch (Exception e) {
            log.error("❌ Delete failed: {}", e.getMessage());
            return ResponseEntity.status(500).body("❌ Delete failed: " + e.getMessage());
        }
    }
}
