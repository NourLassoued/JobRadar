package jobradarbackend.jobradar.user;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jobradarbackend.jobradar.user.dto.AuthResponse;
import jobradarbackend.jobradar.user.dto.LoginRequest;
import jobradarbackend.jobradar.user.dto.RegisterRequest;
import jobradarbackend.jobradar.user.dto.UserResponse;
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

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(authService.register(request));
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

}