package jobradarbackend.jobradar.candidate.language;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;

import java.util.Objects;

/**
 * Une langue parlée par un candidat. Stockée dans la table candidate_languages
 * (une ligne par langue), via @ElementCollection dans Candidate.
 */
@Embeddable
public class CandidateLanguage {

    /** Code de la langue, ex. « fr », « en », « ar » (voir LanguageCatalog) */
    @Column(name = "language_code", nullable = false, length = 10)
    private String code;

    @Enumerated(EnumType.STRING)
    @Column(name = "level", nullable = false, length = 10)
    private LanguageLevel level;

    protected CandidateLanguage() {
        // pour JPA
    }

    public CandidateLanguage(String code, LanguageLevel level) {
        this.code = code;
        this.level = level;
    }

    public String getCode() { return code; }
    public LanguageLevel getLevel() { return level; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof CandidateLanguage other)) return false;
        return Objects.equals(code, other.code);
    }

    @Override
    public int hashCode() {
        return Objects.hash(code);
    }
}