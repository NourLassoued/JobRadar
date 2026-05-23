package jobradarbackend.jobradar.security.oauth2;

import jobradarbackend.jobradar.user.AuthProvider;

import java.util.Map;

public class OAuth2UserInfoFactory {

    public static OAuth2UserInfo extract(AuthProvider provider, Map<String, Object> attributes) {
        return switch (provider) {
            case GOOGLE   -> new GoogleOAuth2UserInfo(attributes);
            case LINKEDIN -> new LinkedInOAuth2UserInfo(attributes);
            default       -> throw new IllegalArgumentException("Provider non supporté: " + provider);
        };
    }
}