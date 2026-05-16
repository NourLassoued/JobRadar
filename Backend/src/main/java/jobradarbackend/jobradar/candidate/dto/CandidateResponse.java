package jobradarbackend.jobradar.candidate.dto;

import jobradarbackend.jobradar.candidate.Candidate;
import jobradarbackend.jobradar.candidate.SectorType;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * DTO de sortie : données renvoyées au client.
 */
@Data
@Builder
public class CandidateResponse {

    private Long id;
    private String firstName;
    private String lastName;
    private String email;
    private String phoneNumber;
    private String city;
    private SectorType sector;
    private Integer yearsOfExperience;
    private String skills;
    private String bio;
    private BigDecimal expectedSalary;
    private Boolean remotePreference;
    private String cvUrl;
    private String linkedinUrl;
    private Boolean isActive;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public static CandidateResponse fromEntity(Candidate c) {
        return CandidateResponse.builder()
                .id(c.getId())
                .firstName(c.getFirstName())
                .lastName(c.getLastName())
                .email(c.getEmail())
                .phoneNumber(c.getPhoneNumber())
                .city(c.getCity())
                .sector(c.getSector())
                .yearsOfExperience(c.getYearsOfExperience())
                .skills(c.getSkills())
                .bio(c.getBio())
                .expectedSalary(c.getExpectedSalary())
                .remotePreference(c.getRemotePreference())
                .cvUrl(c.getCvUrl())
                .linkedinUrl(c.getLinkedinUrl())
                .isActive(c.getIsActive())
                .createdAt(c.getCreatedAt())
                .updatedAt(c.getUpdatedAt())
                .build();
    }
}