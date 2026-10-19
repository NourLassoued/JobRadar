package jobradarbackend.jobradar.matching.recommendation;

import com.fasterxml.jackson.annotation.JsonAnyGetter;
import com.fasterxml.jackson.annotation.JsonProperty;
import jobradarbackend.jobradar.matching.MatchResult;

import java.util.Map;


public class RecommendedOffer {

    private final Map<String, Object> offerFields;
    private final MatchResult match;

    public RecommendedOffer(Map<String, Object> offerFields, MatchResult match) {
        this.offerFields = offerFields;
        this.match = match;
    }

    /** Champs de l'offre, écrits au même niveau que « score » et « match » */
    @JsonAnyGetter
    public Map<String, Object> getOfferFields() {
        return offerFields;
    }

    @JsonProperty("score")
    public int getScore() {
        return match.score();
    }

    @JsonProperty("match")
    public MatchResult getMatch() {
        return match;
    }
}