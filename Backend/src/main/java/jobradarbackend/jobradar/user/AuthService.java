package jobradarbackend.jobradar.user;

import jakarta.servlet.http.HttpServletRequest;
import jobradarbackend.jobradar.candidate.Candidate;
import jobradarbackend.jobradar.candidate.CandidateRepository;
import jobradarbackend.jobradar.security.JwtService;
import jobradarbackend.jobradar.user.dto.AuthResponse;
import jobradarbackend.jobradar.user.dto.LoginRequest;
import jobradarbackend.jobradar.user.dto.RegisterRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;


@Slf4j
@Service
@RequiredArgsConstructor

public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private  final CandidateRepository candidateRepository;



    public User getUserByEmail(String email) {
        System.out.println("Looking for user with email: " + email);

        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> {
                    System.out.println("User not found with email: " + email);
                    return new UsernameNotFoundException("User not found with email: " + email);
                });

        System.out.println("User found: " + user.getId() + " - " + user.getFirstName());
        return user;
    }
    @Transactional
    public AuthResponse register(RegisterRequest request) {
        log.info("Inscription : {}", request.getEmail());

        if (userRepository.existsByEmail(request.getEmail())) {
            throw new IllegalArgumentException("Cet email est d\u00e9j\u00e0 utilis\u00e9.");
        }

        User user = User.builder()

                .email(request.getEmail().toLowerCase().trim())
                .password(passwordEncoder.encode(request.getPassword()))
                .firstName(request.getFirstName())
                .lastName(request.getLastName())
                .role(Role.USER)
                .build();
        User saved = userRepository.save(user);
        log.info("✅ Utilisateur créé : {}", saved.getId());

        // 2️⃣ ✅ CRÉE AUTOMATIQUEMENT LE CANDIDATE
        Candidate candidate = Candidate.builder()
                .user(saved)  // ← Lien vers User
                .firstName(saved.getFirstName())
                .lastName(saved.getLastName())
                .email(saved.getEmail())
                .isActive(true)
                .build();

        candidateRepository.save(candidate);
        log.info("✅ Candidate créé : {}", candidate.getId());

        String token = jwtService.generateToken(saved);
        return buildAuthResponse(saved, token);
    }
    @Transactional(readOnly = true)
    public AuthResponse login(LoginRequest request) {
        log.info("Connexion : {}", request.getEmail());

        User user = userRepository.findByEmail(request.getEmail().toLowerCase().trim())
                .orElseThrow(() -> new IllegalArgumentException("Email ou mot de passe incorrect."));

        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            throw new IllegalArgumentException("Email ou mot de passe incorrect.");
        }

        String token = jwtService.generateToken(user);
        log.info("\u2705 Connexion r\u00e9ussie : {}", user.getEmail());

        return buildAuthResponse(user, token);
    }

    private AuthResponse buildAuthResponse(User user, String token) {
        return AuthResponse.builder()
                .token(token)
                .type("Bearer")
                .id(user.getId())
                .email(user.getEmail())
                .firstName(user.getFirstName())
                .lastName(user.getLastName())
                .role(user.getRole().name())
                .build();
    }
    public void logout(HttpServletRequest request) {
        String authHeader = request.getHeader("Authorization");

        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            log.warn("Logout : aucun token fourni");
            return;
        }

        String token = authHeader.substring(7);
        String userEmail = jwtService.extractEmail(token);

        log.info("Logout réussi : {}", userEmail);


    }

    public User getUserById(Long id) {
        System.out.println(" Looking for user with ID: " + id);

        if (id == null || id <= 0) {
            throw new IllegalArgumentException("User ID must be positive");
        }

        return userRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
    }

// ==================== NEW: PASSWORD RESET METHODS ====================

    /**
     * Générer un token pour reset password (valide 24h)
     */
    public String generatePasswordResetToken(Long userId) {
        try {
            log.info("Generating password reset token for user: {}", userId);
            String resetToken = jwtService.generatePasswordResetToken(userId);
            log.info("✅ Password reset token generated");
            return resetToken;
        } catch (Exception e) {
            log.error("❌ Error generating password reset token: {}", e.getMessage());
            throw new RuntimeException("Failed to generate reset token", e);
        }
    }

    /**
     * Valider un token de reset password
     */
    public boolean isValidPasswordResetToken(String token) {
        try {
            return jwtService.isValidPasswordResetToken(token);
        } catch (Exception e) {
            log.error("❌ Error validating reset token: {}", e.getMessage());
            return false;
        }
    }

    /**
     * Récupérer l'ID du user depuis un token de reset
     */
    public Long getUserIdFromPasswordResetToken(String token) {
        try {
            return jwtService.getUserIdFromPasswordResetToken(token);
        } catch (Exception e) {
            log.error("❌ Error extracting user ID from token: {}", e.getMessage());
            throw new RuntimeException("Invalid token", e);
        }
    }

    /**
     * Update le mot de passe d'un user
     */
    public void updatePassword(Long userId, String newPassword) {
        try {
            User user = userRepository.findById(userId)
                    .orElseThrow(() -> new RuntimeException("User not found"));

            user.setPassword(passwordEncoder.encode(newPassword));
            userRepository.save(user);

            log.info("✅ Password updated for user: {}", userId);

        } catch (Exception e) {
            log.error("❌ Error updating password: {}", e.getMessage());
            throw new RuntimeException("Failed to update password", e);
        }
    }

    /**
     * Check if email exists
     */
    public boolean emailExists(String email) {
        try {
            return userRepository.findByEmail(email).isPresent();
        } catch (Exception e) {
            log.error("❌ Error checking email existence: {}", e.getMessage());
            return false;
        }
    }

}