package jobradarbackend.jobradar.security.oauth2;

public interface OAuth2UserInfo {
    String getId();
    String getEmail();
    String getFirstName();
    String getLastName();
    String getAvatarUrl();
}