package jobradarbackend.jobradar.adzuna;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;


@JsonIgnoreProperties(ignoreUnknown = true)
public record AdzunaSearchResponse(
        Long count,
        List<Job> results
) {

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Job(
            String id,
            String title,
            String description,
            /** Date ISO 8601, ex. 2026-10-01T08:15:00Z */
            String created,
            @JsonProperty("redirect_url") String redirectUrl,
            Company company,
            Location location,
            Category category,
            @JsonProperty("salary_min") Double salaryMin,
            @JsonProperty("salary_max") Double salaryMax,
            /** "1" si le salaire est une estimation d'Adzuna */
            @JsonProperty("salary_is_predicted") String salaryIsPredicted,
            /** permanent | contract */
            @JsonProperty("contract_type") String contractType,
            /** full_time | part_time */
            @JsonProperty("contract_time") String contractTime
    ) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Company(@JsonProperty("display_name") String displayName) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Location(@JsonProperty("display_name") String displayName, List<String> area) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Category(String tag, String label) {}
}