package jobradarbackend.jobradar.security;

import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import jobradarbackend.jobradar.user.User;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;

@Slf4j
@Service
public class JwtService {

    @Value("${jobradar.jwt.secret}")
    private String secret;

    @Value("${jobradar.jwt.expiration}")
    private long expirationMs;

    @Value("${jobradar.jwt.expiration.password-reset:86400000}")
    private long passwordResetExpirationMs;

    // ==================== ACCESS TOKEN ====================

    public String generateToken(User user) {
        Map<String, Object> claims = new HashMap<>();
        claims.put("userId", user.getId());
        claims.put("email", user.getEmail());
        claims.put("provider", user.getProvider().name());
        claims.put("role", user.getRole().name());
        claims.put("type", "access");

        Date now = new Date();
        Date expiration = new Date(now.getTime() + expirationMs);

        return Jwts.builder()
                .claims(claims)
                .subject(user.getEmail())
                .issuedAt(now)
                .expiration(expiration)
                .signWith(getSigningKey())
                .compact();
    }

    public String extractEmail(String token) {
        return parseClaims(token).getSubject();
    }

    public boolean isTokenValid(String token) {
        try {
            Claims claims = parseClaims(token);
            return claims.getExpiration().after(new Date());
        } catch (ExpiredJwtException e) {
            log.warn("⚠️ Token expired");
            return false;
        } catch (JwtException e) {
            log.warn("⚠️ Invalid token: {}", e.getMessage());
            return false;
        } catch (Exception e) {
            log.error("❌ Error validating token: {}", e.getMessage());
            return false;
        }
    }

    private Claims parseClaims(String token) {
        try {
            return Jwts.parser()
                    .verifyWith(getSigningKey())
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
        } catch (ExpiredJwtException e) {
            log.warn("⚠️ Token expired");
            throw e;
        } catch (JwtException e) {
            log.error("❌ Invalid token: {}", e.getMessage());
            throw e;
        }
    }

    // ==================== PASSWORD RESET TOKEN ====================

    public String generatePasswordResetToken(Long userId) {
        try {
            log.info("Generating password reset token for user: {}", userId);

            Map<String, Object> claims = new HashMap<>();
            claims.put("type", "password_reset");

            Date now = new Date();
            Date expiryDate = new Date(now.getTime() + passwordResetExpirationMs);

            String token = Jwts.builder()
                    .claims(claims)
                    .subject(userId.toString())
                    .issuedAt(now)
                    .expiration(expiryDate)
                    .signWith(getSigningKey())
                    .compact();

            log.info("✅ Password reset token generated");
            return token;

        } catch (Exception e) {
            log.error("❌ Error generating password reset token: {}", e.getMessage());
            throw new RuntimeException("Failed to generate reset token", e);
        }
    }

    public boolean isValidPasswordResetToken(String token) {
        try {
            Claims claims = Jwts.parser()
                    .verifyWith(getSigningKey())
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();

            String type = (String) claims.get("type");
            boolean isValid = "password_reset".equals(type);

            if (isValid) {
                log.info("✅ Password reset token is valid");
            } else {
                log.warn("⚠️ Token type is not password_reset");
            }

            return isValid;

        } catch (ExpiredJwtException e) {
            log.warn("⚠️ Password reset token expired");
            return false;
        } catch (JwtException e) {
            log.warn("⚠️ Invalid password reset token: {}", e.getMessage());
            return false;
        } catch (Exception e) {
            log.error("❌ Error validating password reset token: {}", e.getMessage());
            return false;
        }
    }

    public Long getUserIdFromPasswordResetToken(String token) {
        try {
            Claims claims = Jwts.parser()
                    .verifyWith(getSigningKey())
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();

            String type = (String) claims.get("type");
            if (!"password_reset".equals(type)) {
                log.error("❌ Token is not a password reset token");
                throw new RuntimeException("Invalid token type");
            }

            Long userId = Long.parseLong(claims.getSubject());
            log.info("✅ UserId extracted from password reset token: {}", userId);
            return userId;

        } catch (ExpiredJwtException e) {
            log.warn("⚠️ Password reset token expired");
            throw new RuntimeException("Token expired", e);
        } catch (JwtException e) {
            log.warn("⚠️ Invalid password reset token");
            throw new RuntimeException("Invalid token", e);
        } catch (Exception e) {
            log.error("❌ Error extracting user ID from token: {}", e.getMessage());
            throw new RuntimeException("Invalid token", e);
        }
    }

    // ==================== HELPER METHODS ====================

    private SecretKey getSigningKey() {
        byte[] keyBytes = secret.getBytes(StandardCharsets.UTF_8);
        return Keys.hmacShaKeyFor(keyBytes);
    }

    public boolean isTokenExpired(String token) {
        try {
            Claims claims = parseClaims(token);
            Date expiration = claims.getExpiration();
            return expiration != null && expiration.before(new Date());
        } catch (ExpiredJwtException e) {
            return true;
        } catch (Exception e) {
            log.error("❌ Error checking token expiration: {}", e.getMessage());
            return true;
        }
    }

    public Date getExpirationDateFromToken(String token) {
        try {
            Claims claims = parseClaims(token);
            return claims.getExpiration();
        } catch (Exception e) {
            log.error("❌ Error getting expiration date: {}", e.getMessage());
            return null;
        }
    }
}