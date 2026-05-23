package jobradarbackend.jobradar.security.oauth2;

import jobradarbackend.jobradar.user.AuthProvider;
import jobradarbackend.jobradar.user.User;
import jobradarbackend.jobradar.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.oauth2.client.userinfo.DefaultOAuth2UserService;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserRequest;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
@RequiredArgsConstructor
public class CustomOAuth2UserService extends DefaultOAuth2UserService {

    private final UserRepository userRepository;

    @Override
    public OAuth2User loadUser(OAuth2UserRequest request) {
        OAuth2User oAuth2User = super.loadUser(request);
        String providerName = request.getClientRegistration().getRegistrationId().toUpperCase();
        AuthProvider provider = AuthProvider.valueOf(providerName);

        OAuth2UserInfo info = OAuth2UserInfoFactory.extract(provider, oAuth2User.getAttributes());

        if (info.getEmail() == null || info.getEmail().isBlank()) {
            throw new RuntimeException("Email non fourni par " + providerName);
        }

        User user = userRepository.findByEmail(info.getEmail())
                .map(existing -> updateUser(existing, info, provider))
                .orElseGet(() -> registerNewUser(info, provider));

        return new CustomOAuth2User(user, oAuth2User.getAttributes());
    }

    private User registerNewUser(OAuth2UserInfo info, AuthProvider provider) {
        User user = User.builder()
                .email(info.getEmail())
                .firstName(info.getFirstName())
                .lastName(info.getLastName())
                .avatarUrl(info.getAvatarUrl())
                .provider(provider)
                .providerId(info.getId())
                .build();
        return userRepository.save(user);
    }

    private User updateUser(User user, OAuth2UserInfo info, AuthProvider provider) {
        // Si le user existait en LOCAL, on garde son provider d'origine
        if (user.getProvider() == AuthProvider.LOCAL) {
            return user;
        }
        user.setFirstName(info.getFirstName());
        user.setLastName(info.getLastName());
        user.setAvatarUrl(info.getAvatarUrl());
        return userRepository.save(user);
    }
}