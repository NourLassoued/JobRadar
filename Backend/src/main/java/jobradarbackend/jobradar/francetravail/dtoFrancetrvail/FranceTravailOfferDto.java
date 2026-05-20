package jobradarbackend.jobradar.francetravail.dtoFrancetrvail;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;

import java.util.List;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class FranceTravailOfferDto {

    // ============================================================
    // Champs simples
    // ============================================================
    private String id;
    private String intitule;          // titre de l'offre
    private String description;
    private String dateCreation;
    private String typeContrat;       // CDI, CDD, MIS, ...
    private String typeContratLibelle;
    private String appellationlibelle; // métier ROME (attention : minuscule)
    private String secteurActiviteLibelle;
    private String dureeTravailLibelleConverti;

    // ============================================================
    // Objets imbriqués
    // ============================================================
    private SalaireDto salaire;
    private LieuTravailDto lieuTravail;
    private OrigineOffreDto origineOffre;
    private EntrepriseDto entreprise;        // ⚠️ Doit être un OBJET, pas un String !

    // ============================================================
    // Listes
    // ============================================================
    private List<CompetenceDto> competences;

    // ============================================================
    // Sous-classes internes
    // ============================================================

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class SalaireDto {
        private String libelle;
        private String commentaire;
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class LieuTravailDto {
        private String libelle;
        private String latitude;
        private String longitude;
        private String codePostal;
        private String commune;
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class OrigineOffreDto {
        private String origine;
        private String urlOrigine;
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class EntrepriseDto {
        private String nom;
        private String description;
        private String url;
        private String entrepriseAdaptee;   // bonus
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class CompetenceDto {
        private String code;
        private String libelle;
        private String exigence;
    }
}