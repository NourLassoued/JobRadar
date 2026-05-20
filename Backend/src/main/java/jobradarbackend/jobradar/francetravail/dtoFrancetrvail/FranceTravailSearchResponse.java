package jobradarbackend.jobradar.francetravail.dtoFrancetrvail;


import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;

import java.util.List;


@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class FranceTravailSearchResponse {
    private List<FranceTravailOfferDto> resultats;
}