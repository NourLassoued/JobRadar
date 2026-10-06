package jobradarbackend.jobradar.user;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jobradarbackend.jobradar.user.dto.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import lombok.extern.slf4j.Slf4j;


@RestController
@RequestMapping("/api/auth")
@Slf4j

@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final EmailService emailService;

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest request) {
        log.info("Register request for email: {}", request.getEmail());

        try {
            // Créer l'utilisateur
            AuthResponse authResponse = authService.register(request);

            // Récupérer l'utilisateur créé
            User user = authService.getUserByEmail(request.getEmail());

            // Envoyer email de bienvenue
            if (user != null) {
                emailService.sendWelcomeEmail(
                        user.getEmail(),
                        user.getFirstName(),
                        "EMAIL"  // ou utiliser: user.getProvider().name()
                );

                log.info("✅ Welcome email sent to: {}", request.getEmail());
            }

            return ResponseEntity.status(HttpStatus.CREATED).body(authResponse);

        } catch (Exception e) {
            log.error("❌ Register error: {}", e.getMessage());
            throw e;
        }
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        return ResponseEntity.ok(authService.login(request));
    }
    @PostMapping("/logout")
    public ResponseEntity<Void> logout(HttpServletRequest request) {
        authService.logout(request);
        return ResponseEntity.noContent().build(); // 204
    }
    @GetMapping("/me")
    public ResponseEntity<AuthResponse> getCurrentUser(
            Authentication authentication,
            HttpServletRequest request
    ) {
        if (authentication == null || !authentication.isAuthenticated()) {
            log.warn("❌ Unauthorized access to /api/auth/me");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        try {
            String email = authentication.getName();
            log.info("📥 Fetching user info for: {}", email);

            User user = authService.getUserByEmail(email);

            String token = extractTokenFromRequest(request);

            AuthResponse response = AuthResponse.builder()
                    .token(token)
                    .type("Bearer")
                    .id(user.getId())
                    .email(user.getEmail())
                    .firstName(user.getFirstName())
                    .lastName(user.getLastName())
                    .role(user.getRole().toString())
                    .build();

            log.info("✅ User info retrieved: {}", email);
            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("❌ Error fetching user: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
    }
    private String extractTokenFromRequest(HttpServletRequest request) {
        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            return header.substring(7);  // Enlève "Bearer "
        }
        return null;
    }
    @GetMapping("/user/{id}")
    public ResponseEntity<UserResponse> getUserById(@PathVariable Long id) {
        try {
            User user = authService.getUserById(id);
            return ResponseEntity.ok(UserResponse.fromEntity(user));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        }
    }
    /**
     * POST /api/auth/forgot-password
     * Request password reset email
     */
    @PostMapping("/forgot-password")
    public ResponseEntity<?> forgotPassword(@Valid @RequestBody ForgotPasswordRequest request) {
        log.info("Forgot password request for email: {}", request.getEmail());

        try {
            User user = authService.getUserByEmail(request.getEmail());

            if (user != null) {
                // Générer reset token
                String resetToken = authService.generatePasswordResetToken(user.getId());
                // ✅ AJOUTE CES 2 LIGNES POUR VOIR LE TOKEN EN LOGS
                log.info("🔐 DEBUG TOKEN: {}", resetToken);
                System.out.println("\n\n🔐🔐🔐 RESET TOKEN FOR TESTING: " + resetToken + "\n\n");
                // Envoyer email
                emailService.sendResetPasswordEmail(
                        user.getEmail(),
                        user.getFirstName(),
                        resetToken
                );

                log.info("✅ Reset password email sent to: {}", request.getEmail());
            } else {
                log.warn("⚠️ Forgot password request for non-existent email: {}", request.getEmail());
            }

            // Toujours retourner 200 pour la sécurité (ne pas révéler si email existe)
            return ResponseEntity.ok(java.util.Map.of(
                    "success", true,
                    "message", "If an account exists, a reset email has been sent."
            ));

        } catch (Exception e) {
            log.error("❌ Forgot password error: {}", e.getMessage());
            return ResponseEntity.ok(java.util.Map.of(
                    "success", true,
                    "message", "If an account exists, a reset email has been sent."
            ));
        }
    }

    /**
     * POST /api/auth/reset-password
     * Reset password with token from email
     */
    @PostMapping("/reset-password")
    public ResponseEntity<?> resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        log.info("Reset password request received");

        try {
            // Valider le token
            if (!authService.isValidPasswordResetToken(request.getToken())) {
                log.warn("❌ Invalid or expired reset token");
                return ResponseEntity.badRequest().body(java.util.Map.of(
                        "success", false,
                        "message", "Invalid or expired reset token. Please request a new one."
                ));
            }

            // Récupérer l'ID du user depuis le token
            Long userId = authService.getUserIdFromPasswordResetToken(request.getToken());

            // Récupérer le user
            User user = authService.getUserById(userId);
            if (user == null) {
                log.error("❌ User not found for ID: {}", userId);
                return ResponseEntity.badRequest().body(java.util.Map.of(
                        "success", false,
                        "message", "User not found"
                ));
            }

            // Valider le nouveau mot de passe
            if (request.getNewPassword() == null || request.getNewPassword().length() < 8) {
                log.warn("❌ Password too weak");
                return ResponseEntity.badRequest().body(java.util.Map.of(
                        "success", false,
                        "message", "Password must be at least 8 characters long"
                ));
            }

            // Update le mot de passe
            authService.updatePassword(userId, request.getNewPassword());

            // Envoyer email de confirmation
            emailService.sendSimpleEmail(
                    user.getEmail(),
                    "Ton mot de passe a été réinitialisé ✅",
                    "Bonjour " + user.getFirstName() + ",\n\n" +
                            "Ton mot de passe JobRadar a été réinitialisé avec succès.\n\n" +
                            "Si tu n'as pas fait cette action, contacte-nous immédiatement.\n\n" +
                            "À bientôt,\nL'équipe JobRadar"
            );

            log.info("✅ Password reset successful for user: {}", userId);

            return ResponseEntity.ok(java.util.Map.of(
                    "success", true,
                    "message", "Password reset successful! Please login with your new password.",
                    "redirectTo", "/login"
            ));

        } catch (Exception e) {
            log.error("❌ Password reset error: {}", e.getMessage());
            return ResponseEntity.badRequest().body(java.util.Map.of(
                    "success", false,
                    "message", "An error occurred during password reset. Please try again."
            ));
        }
    }

    @PostMapping("/love")
    public ResponseEntity<String> sendLoveEmail(@RequestBody EmailRequest request) {
        try {
            emailService.sendLoveEmail(request.getTo());
            return ResponseEntity.ok("Email envoyé à " + request.getTo() + " 💕");
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body("Échec de l'envoi : " + e.getMessage());
        }
    }
}