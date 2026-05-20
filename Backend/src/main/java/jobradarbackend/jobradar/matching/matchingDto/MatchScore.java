package jobradarbackend.jobradar.matching.matchingDto;

import jobradarbackend.jobradar.joboffer.DtoJoboffer.JobOfferResponse;
import lombok.Builder;
import lombok.Data;

import java.util.List;


@Data
@Builder
public class MatchScore {


    private JobOfferResponse jobOffer;


    private Integer totalScore;


    private MatchLevel matchLevel;


    private ScoreBreakdown breakdown;


    private List<String> strengths;


    private List<String> weaknesses;


    public enum MatchLevel {
        EXCELLENT,
        GOOD,
        AVERAGE,
        POOR
    }


    @Data
    @Builder
    public static class ScoreBreakdown {
        private Integer sectorScore;
        private Integer locationScore;
        private Integer experienceScore;
        private Integer salaryScore;
        private Integer remoteScore;
    }
}