package jobradarbackend.jobradar.candidate.language;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** Langue envoyée par le frontend et renvoyée dans le profil : { "code": "en", "level": "B2" } */
public record LanguageDto(
        @NotBlank @Size(max = 10) String code,
        @NotNull LanguageLevel level
) {
    public static LanguageDto from(CandidateLanguage language) {
        return new LanguageDto(language.getCode(), language.getLevel());
    }
}
