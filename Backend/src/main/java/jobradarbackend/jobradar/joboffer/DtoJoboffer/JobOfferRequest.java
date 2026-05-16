package jobradarbackend.jobradar.joboffer.DtoJoboffer;

import jakarta.validation.constraints.*;
import jobradarbackend.jobradar.joboffer.ContractType;
import lombok.Data;

import java.math.BigDecimal;


@Data
public class JobOfferRequest {

    @NotBlank(message = "Le titre est obligatoire")
    @Size(max = 200)
    private String title;

    @NotBlank(message = "L'entreprise est obligatoire")
    @Size(max = 200)
    private String company;

    @Size(max = 200)
    private String location;

    @Size(max = 50)
    private String sector;

    @NotNull(message = "Le type de contrat est obligatoire")
    private ContractType contractType;

    @DecimalMin(value = "0.0", message = "Le salaire ne peut pas être négatif")
    private BigDecimal salaryMin;

    @DecimalMin(value = "0.0", message = "Le salaire ne peut pas être négatif")
    private BigDecimal salaryMax;

    @Size(max = 5000)
    private String description;

    @Size(max = 2000)
    private String requirements;

    private Boolean remote;

    @Size(max = 500)
    private String url;

    @Size(max = 100)
    private String source;
}