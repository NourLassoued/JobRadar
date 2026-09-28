package jobradarbackend.jobradar.security.oauth2;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jobradarbackend.jobradar.candidate.Candidate;
import jobradarbackend.jobradar.candidate.CandidateRepository;
import jobradarbackend.jobradar.security.JwtService;
import jobradarbackend.jobradar.user.AuthProvider;
import jobradarbackend.jobradar.user.Role;
import jobradarbackend.jobradar.user.User;
import jobradarbackend.jobradar.user.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationSuccessHandler;
import org.springframework.stereotype.Component;
import org.springframework.web.util.UriComponentsBuilder;

import java.io.IOException;

@Component
@RequiredArgsConstructor
@Slf4j
public class OAuth2SuccessHandler extends SimpleUrlAuthenticationSuccessHandler {

    private final JwtService jwtService;
    private final UserRepository userRepository;
    private final CandidateRepository candidateRepository;

    @Value("${jobradar.frontend.url}")
    private String frontendUrl;

    @Value("${jobradar.frontend.oauth-redirect-path}")
    private String oauthRedirectPath;

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request,
                                        HttpServletResponse response,
                                        Authentication authentication) throws IOException {

        String token;

        if (authentication.getPrincipal() instanceof CustomOAuth2User oAuth2User) {
            token = jwtService.generateToken(oAuth2User.getUser());
        } else if (authentication.getPrincipal() instanceof OidcUser oidcUser) {
            String email = oidcUser.getEmail();
            User user = userRepository.findByEmail(email)
                    .orElseGet(() -> createNewOAuth2User(oidcUser));
            token = jwtService.generateToken(user);
        } else {
            throw new RuntimeException("Unknown principal: " + authentication.getPrincipal().getClass());
        }

        String targetUrl = UriComponentsBuilder.fromUriString(frontendUrl + oauthRedirectPath)
                .queryParam("token", token)
                .build()
                .toUriString();

        getRedirectStrategy().sendRedirect(request, response, targetUrl);
    }

    /**
     * Crée un nouvel utilisateur lors de la première connexion OAuth2
     * Fonctionne pour Google ET LinkedIn
     */
    private User createNewOAuth2User(OidcUser oidcUser) {
        String email = oidcUser.getEmail();

        // ✅ FIX LinkedIn: LinkedIn ne retourne pas givenName/familyName
        // On utilise fullName comme fallback
        String firstName = oidcUser.getGivenName() != null
                ? oidcUser.getGivenName()
                : extractFirstName(oidcUser.getFullName());

        String lastName = oidcUser.getFamilyName() != null
                ? oidcUser.getFamilyName()
                : extractLastName(oidcUser.getFullName());

        String avatarUrl = oidcUser.getPicture();

        // Déterminer le provider (GOOGLE ou LINKEDIN)
        AuthProvider provider = determineProvider(oidcUser);
        String providerId = oidcUser.getSubject();  // ID unique fourni par le provider

        // ✅ Créer l'utilisateur
        User newUser = User.builder()
                .email(email.toLowerCase().trim())
                .password(null)  // Pas de mot de passe pour OAuth
                .firstName(firstName)
                .lastName(lastName)
                .avatarUrl(avatarUrl)
                .role(Role.USER)
                .provider(provider)
                .providerId(providerId)
                .build();

        User savedUser = userRepository.save(newUser);
        log.info("✅ User créé via OAuth2: {} ({})", email, provider);

        // ✅ Créer automatiquement le Candidate
        Candidate candidate = Candidate.builder()
                .user(savedUser)
                .firstName(firstName)
                .lastName(lastName)
                .email(email)
                .isActive(true)
                .build();

        candidateRepository.save(candidate);
        log.info("✅ Candidate créé automatiquement pour: {}", email);

        return savedUser;
    }

    /**
     * Extrait le prénom à partir du fullName
     * Exemple: "Nour El Houda Lassoued" → "Nour"
     */
    private String extractFirstName(String fullName) {
        if (fullName == null || fullName.trim().isEmpty()) {
            log.warn("⚠️ fullName est null ou vide, utilisant 'User' par défaut");
            return "User";
        }
        String[] parts = fullName.trim().split(" ");
        return parts[0];
    }

    /**
     * Extrait le nom à partir du fullName
     * Exemple: "Nour El Houda Lassoued" → "Lassoued"
     */
    private String extractLastName(String fullName) {
        if (fullName == null || fullName.trim().isEmpty()) {
            log.warn("⚠️ fullName est null ou vide, lastName vide");
            return "";
        }
        String[] parts = fullName.trim().split(" ");
        return parts.length > 1 ? parts[parts.length - 1] : "";
    }

    /**
     * Détermine le provider OAuth2 (GOOGLE ou LINKEDIN)
     */
    private AuthProvider determineProvider(OidcUser oidcUser) {
        String issuer = oidcUser.getIssuer() != null ? oidcUser.getIssuer().toString() : "";
        log.info("🔍 OAuth2 Issuer: {}", issuer);

        if (issuer.contains("linkedin")) {
            log.info("✅ Provider détecté: LINKEDIN");
            return AuthProvider.LINKEDIN;
        }
        log.info("✅ Provider détecté: GOOGLE");
        return AuthProvider.GOOGLE;
    }
}