package jobradarbackend.jobradar.candidate;

import jobradarbackend.jobradar.user.User;
import jobradarbackend.jobradar.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import java.security.Principal;

/** Retrouve l'id du candidat connecté à partir du JWT (Principal = e-mail) */
@Component
@RequiredArgsConstructor
public class CurrentCandidateResolver {

    private final UserRepository userRepository;
    private final CandidateRepository candidateRepository;

    public Long candidateId(Principal principal) {
        if (principal == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Connexion requise.");
        }
        User user = userRepository.findByEmail(principal.getName())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Utilisateur introuvable."));
        return candidateRepository.findByUserId(user.getId())
                .map(Candidate::getId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Complétez votre profil candidat pour utiliser l'IA."));
    }
}