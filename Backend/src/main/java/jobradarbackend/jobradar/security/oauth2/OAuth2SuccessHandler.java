package jobradarbackend.jobradar.security.oauth2;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jobradarbackend.jobradar.security.JwtService;
import jobradarbackend.jobradar.user.User;
import jobradarbackend.jobradar.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationSuccessHandler;
import org.springframework.stereotype.Component;
import org.springframework.web.util.UriComponentsBuilder;

import java.io.IOException;

@Component
@RequiredArgsConstructor
public class OAuth2SuccessHandler extends SimpleUrlAuthenticationSuccessHandler {

    private final JwtService jwtService;
    private final UserRepository userRepository;

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
                    .orElseThrow(() -> new RuntimeException("User not found: " + email));
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
}