package jobradarbackend.jobradar.candidate.dto;

import jakarta.validation.constraints.*;
import jobradarbackend.jobradar.candidate.SectorType;
import lombok.Data;

import java.math.BigDecimal;


@Data
public class CandidateRequest {

    @NotBlank(message = "Le prénom est obligatoire")
    @Size(max = 100)
    private String firstName;

    @NotBlank(message = "Le nom est obligatoire")
    @Size(max = 100)
    private String lastName;

    @NotBlank(message = "L'email est obligatoire")
    @Email(message = "Email invalide")
    private String email;

    @Size(max = 20)
    private String phoneNumber;

    @Size(max = 200)
    private String city;

    private SectorType sector;

    @Min(value = 0, message = "L'expérience ne peut pas être négative")
    @Max(value = 60, message = "L'expérience ne peut pas dépasser 60 ans")
    private Integer yearsOfExperience;

    @Size(max = 2000)
    private String skills;

    @Size(max = 1000)
    private String bio;

    @DecimalMin(value = "0.0", message = "Le salaire ne peut pas être négatif")
    private BigDecimal expectedSalary;

    private Boolean remotePreference;

    @Size(max = 500)
    private String cvUrl;

    @Size(max = 500)
    private String linkedinUrl;
}