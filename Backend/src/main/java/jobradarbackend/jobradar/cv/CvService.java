package jobradarbackend.jobradar.cv;

import jobradarbackend.jobradar.ai.AiException;
import jobradarbackend.jobradar.candidate.CandidateRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.List;

/** Gestion des CV du candidat (plusieurs CV, un par défaut) */
@Service
@RequiredArgsConstructor
public class CvService {

    private final CandidateCvRepository cvRepository;
    private final CandidateRepository candidateRepository;
    private final CvTextExtractor textExtractor;
    private final TransactionTemplate tx;

    @Transactional(readOnly = true)
    public List<CvDtos.CvResponse> list(Long candidateId) {
        return cvRepository.findByCandidateIdOrderByCreatedAtDesc(candidateId).stream()
                .map(CvDtos.CvResponse::from).toList();
    }

    @Transactional
    public CvDtos.CvResponse create(Long candidateId, CvDtos.CreateCvRequest req) {
        boolean first = cvRepository.countByCandidateId(candidateId) == 0;
        boolean makeDefault = first || req.makeDefault();
        if (makeDefault) clearDefault(candidateId);

        CandidateCv cv = CandidateCv.builder()
                .candidate(candidateRepository.getReferenceById(candidateId))
                .title(req.title().trim())
                .fileName(req.fileName())
                .fileUrl(req.fileUrl())
                .contentType(req.contentType())
                .fileSize(req.fileSize())
                .defaultCv(makeDefault)
                .build();
        return CvDtos.CvResponse.from(cvRepository.save(cv));
    }

    @Transactional
    public CvDtos.CvResponse setDefault(Long candidateId, Long cvId) {
        CandidateCv cv = owned(candidateId, cvId);
        clearDefault(candidateId);
        cv.setDefaultCv(true);
        return CvDtos.CvResponse.from(cv);
    }

    @Transactional
    public void delete(Long candidateId, Long cvId) {
        CandidateCv cv = owned(candidateId, cvId);
        boolean wasDefault = cv.isDefaultCv();
        cvRepository.delete(cv);
        cvRepository.flush();
        if (wasDefault) {
            cvRepository.findByCandidateIdOrderByCreatedAtDesc(candidateId).stream().findFirst()
                    .ifPresent(next -> next.setDefaultCv(true));
        }
    }

    /**
     * Texte du CV : extrait du PDF à la première utilisation, puis gardé en base.
     * Le téléchargement se fait hors transaction (appel réseau).
     */
    public String ensureText(Long candidateId, Long cvId) {
        CandidateCv cv = tx.execute(s -> owned(candidateId, cvId));
        if (cv.getExtractedText() != null && !cv.getExtractedText().isBlank()) {
            return cv.getExtractedText();
        }
        String text = textExtractor.extract(cv.getFileUrl(), cv.getContentType(), cv.getFileName());
        tx.executeWithoutResult(s -> owned(candidateId, cvId).setExtractedText(text));
        return text;
    }

    /** CV choisi, ou le CV par défaut si aucun n'est indiqué */
    @Transactional(readOnly = true)
    public Long resolveCvId(Long candidateId, Long cvId) {
        if (cvId != null) return owned(candidateId, cvId).getId();
        return cvRepository.findFirstByCandidateIdAndDefaultCvTrue(candidateId)
                .map(CandidateCv::getId)
                .orElseThrow(() -> new AiException(AiException.Reason.CV_TEXT_MISSING,
                        "Ajoutez d'abord un CV à votre profil."));
    }

    private CandidateCv owned(Long candidateId, Long cvId) {
        return cvRepository.findByIdAndCandidateId(cvId, candidateId)
                .orElseThrow(() -> new AiException(AiException.Reason.NOT_FOUND, "CV introuvable."));
    }

    private void clearDefault(Long candidateId) {
        cvRepository.findFirstByCandidateIdAndDefaultCvTrue(candidateId).ifPresent(cv -> {
            cv.setDefaultCv(false);
            cvRepository.saveAndFlush(cv);
        });
    }
}