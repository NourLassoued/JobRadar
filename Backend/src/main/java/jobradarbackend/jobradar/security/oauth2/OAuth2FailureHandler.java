package jobradarbackend.jobradar.security.oauth2;

import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.web.authentication.AuthenticationFailureHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

@Component
public class OAuth2FailureHandler implements AuthenticationFailureHandler {

    @Value("${jobradar.frontend.url:http://localhost:4200}")
    private String frontendUrl;

    @Override
    public void onAuthenticationFailure(
            HttpServletRequest request,
            HttpServletResponse response,
            AuthenticationException exception
    ) throws IOException, ServletException {

        System.err.println("════════════════════════════════════════════════════════════════");
        System.err.println("🔴 OAUTH2 AUTHENTICATION FAILED");
        System.err.println("════════════════════════════════════════════════════════════════");

        System.err.println("📍 Request Details:");
        System.err.println("   - Request URI: " + request.getRequestURI());
        System.err.println("   - Exception: " + exception.getClass().getSimpleName());
        System.err.println("   - Message: " + exception.getMessage());

        if (exception instanceof OAuth2AuthenticationException oAuth2Ex) {
            System.err.println("🔐 OAuth2 Error:");
            OAuth2Error error = oAuth2Ex.getError();
            if (error != null) {
                System.err.println("   - Code: " + error.getErrorCode());
                System.err.println("   - Description: " + error.getDescription());
            }
            if (oAuth2Ex.getCause() != null) {
                System.err.println("📌 Root Cause: " + oAuth2Ex.getCause().getMessage());
                oAuth2Ex.getCause().printStackTrace();
            }
        }

        System.err.println("════════════════════════════════════════════════════════════════");

        String errorCode = "oauth_failed";
        String errorMessage = "OAuth2 authentication failed";

        if (exception instanceof OAuth2AuthenticationException oAuth2Ex) {
            OAuth2Error error = oAuth2Ex.getError();
            if (error != null) {
                errorCode = error.getErrorCode();
                errorMessage = error.getDescription() != null ? error.getDescription() : error.getErrorCode();
            }
        }

        String encodedErrorCode = URLEncoder.encode(errorCode, StandardCharsets.UTF_8);
        String encodedErrorMessage = URLEncoder.encode(errorMessage, StandardCharsets.UTF_8);

        String redirectUrl = String.format(
                "%s/auth/login?error=%s&message=%s",
                frontendUrl,
                encodedErrorCode,
                encodedErrorMessage
        );

        System.err.println("🔄 Redirecting to: " + redirectUrl);
        response.sendRedirect(redirectUrl);
    }
}