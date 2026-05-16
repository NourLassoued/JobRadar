package jobradarbackend.jobradar.joboffer.DtoJoboffer;

import jobradarbackend.jobradar.joboffer.ContractType;
import jobradarbackend.jobradar.joboffer.JobOffer;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;


@Data
@Builder
public class JobOfferResponse {

    private Long id;
    private String title;
    private String company;
    private String location;
    private String sector;
    private ContractType contractType;
    private BigDecimal salaryMin;
    private BigDecimal salaryMax;
    private String description;
    private String requirements;
    private Boolean remote;
    private String url;
    private String source;
    private Boolean isActive;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    /**
     * Convertit une entité JobOffer en JobOfferResponse.
     */
    public static JobOfferResponse fromEntity(JobOffer offer) {
        return JobOfferResponse.builder()
                .id(offer.getId())
                .title(offer.getTitle())
                .company(offer.getCompany())
                .location(offer.getLocation())
                .sector(offer.getSector())
                .contractType(offer.getContractType())
                .salaryMin(offer.getSalaryMin())
                .salaryMax(offer.getSalaryMax())
                .description(offer.getDescription())
                .requirements(offer.getRequirements())
                .remote(offer.getRemote())
                .url(offer.getUrl())
                .source(offer.getSource())
                .isActive(offer.getIsActive())
                .createdAt(offer.getCreatedAt())
                .updatedAt(offer.getUpdatedAt())
                .build();
    }
}