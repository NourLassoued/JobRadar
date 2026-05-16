package jobradarbackend.jobradar.user;

import jobradarbackend.jobradar.security.JwtService;
import jobradarbackend.jobradar.user.dto.AuthResponse;
import jobradarbackend.jobradar.user.dto.LoginRequest;
import jobradarbackend.jobradar.user.dto.RegisterRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;


@Slf4j
@Service
@RequiredArgsConstructor
@Transactional
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

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
        log.info("\u2705 Utilisateur cr\u00e9\u00e9 : {}", saved.getId());

        String token = jwtService.generateToken(saved);
        return buildAuthResponse(saved, token);
    }

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
                .userId(user.getId())
                .email(user.getEmail())
                .firstName(user.getFirstName())
                .lastName(user.getLastName())
                .role(user.getRole().name())
                .build();
    }
}