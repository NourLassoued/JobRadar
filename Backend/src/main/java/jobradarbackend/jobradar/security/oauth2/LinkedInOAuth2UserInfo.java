package jobradarbackend.jobradar.security.oauth2;

import lombok.AllArgsConstructor;

import java.util.Map;

@AllArgsConstructor
public class LinkedInOAuth2UserInfo implements OAuth2UserInfo {

    private final Map<String, Object> attributes;

    @Override public String getId()        { return (String) attributes.get("sub"); }
    @Override public String getEmail()     { return (String) attributes.get("email"); }
    @Override public String getFirstName() { return (String) attributes.get("given_name"); }
    @Override public String getLastName()  { return (String) attributes.get("family_name"); }
    @Override public String getAvatarUrl() { return (String) attributes.get("picture"); }
}