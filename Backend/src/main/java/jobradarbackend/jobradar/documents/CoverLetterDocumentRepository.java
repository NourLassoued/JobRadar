package jobradarbackend.jobradar.documents;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

/** Accès à la table candidate_cover_letters */
public interface CoverLetterDocumentRepository extends JpaRepository<CoverLetterDocument, Long> {

    /** Lettres d'un candidat, de la plus récente à la plus ancienne (liste du formulaire) */
    List<CoverLetterDocument> findByCandidateIdOrderByCreatedAtDesc(Long candidateId);

    /** Une lettre n'est utilisable que par son propriétaire : vide si elle appartient à un autre candidat */
    Optional<CoverLetterDocument> findByIdAndCandidateId(Long id, Long candidateId);
}