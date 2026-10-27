package jobradarbackend.jobradar.documents;

import jobradarbackend.jobradar.candidate.Candidate;
import jobradarbackend.jobradar.candidate.CandidateRepository;
import jobradarbackend.jobradar.documents.DocumentDtos.CoverLetterResponse;
import jobradarbackend.jobradar.documents.DocumentDtos.UploadedFileResponse;
import jobradarbackend.jobradar.documents.DocumentStorageService.StoredFile;
import jobradarbackend.jobradar.user.User;
import jobradarbackend.jobradar.user.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.security.Principal;
import java.util.List;

/** CV et lettres de motivation déposés par le candidat connecté */
@Service
public class DocumentService {

    private final UserRepository userRepository;
    private final CandidateRepository candidateRepository;
    private final CoverLetterDocumentRepository letterRepository;
    private final DocumentStorageService storage;

    public DocumentService(UserRepository userRepository,
                           CandidateRepository candidateRepository,
                           CoverLetterDocumentRepository letterRepository,
                           DocumentStorageService storage) {
        this.userRepository = userRepository;
        this.candidateRepository = candidateRepository;
        this.letterRepository = letterRepository;
        this.storage = storage;
    }

    /** Envoie le fichier d'un nouveau CV ; le front l'enregistre ensuite avec POST /api/cvs */
    public UploadedFileResponse uploadCvFile(Principal principal, MultipartFile file) {
        User user = currentUser(principal);
        StoredFile f = storage.upload("cvs", user.getId(), file);
        return new UploadedFileResponse(f.fileUrl(), f.fileName(), f.contentType(), f.fileSize());
    }

    @Transactional(readOnly = true)
    public List<CoverLetterResponse> listCoverLetters(Principal principal) {
        Candidate candidate = currentCandidate(principal);
        return letterRepository.findByCandidateIdOrderByCreatedAtDesc(candidate.getId()).stream()
                .map(CoverLetterResponse::from)
                .toList();
    }

    /** Envoie et enregistre une nouvelle lettre de motivation */
    @Transactional
    public CoverLetterResponse uploadCoverLetter(Principal principal, MultipartFile file, String title) {
        Candidate candidate = currentCandidate(principal);
        StoredFile f = storage.upload("cover-letters", candidate.getId(), file);

        CoverLetterDocument letter = new CoverLetterDocument();
        letter.setCandidate(candidate);
        letter.setTitle(title == null || title.isBlank() ? f.fileName() : title.strip());
        letter.setFileName(f.fileName());
        letter.setFileUrl(f.fileUrl());
        letter.setContentType(f.contentType());
        letter.setFileSize(f.fileSize());
        return CoverLetterResponse.from(letterRepository.save(letter));
    }

    private User currentUser(Principal principal) {
        if (principal == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Connexion requise.");
        return userRepository.findByEmail(principal.getName())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Utilisateur introuvable."));
    }

    private Candidate currentCandidate(Principal principal) {
        return candidateRepository.findByUserId(currentUser(principal).getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT,
                        "Complétez d'abord votre profil candidat."));
    }
}
