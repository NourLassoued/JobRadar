package jobradarbackend.jobradar.francetravail;

import jobradarbackend.jobradar.francetravail.client.FranceTravailClient;
import jobradarbackend.jobradar.francetravail.dtoFrancetrvail.FranceTravailOfferDto;
import jobradarbackend.jobradar.joboffer.ContractType;
import jobradarbackend.jobradar.joboffer.JobOffer;
import jobradarbackend.jobradar.joboffer.JobOfferRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;


@Slf4j
@Service
@RequiredArgsConstructor
public class FranceTravailImportService {

    private final FranceTravailClient client;
    private final JobOfferRepository jobOfferRepository;

    private static final Pattern SALARY_PATTERN = Pattern.compile("(\\d+)\\s*(\\d*)");


    @Transactional
    public int importOffers(String motsCles, String commune, int maxResults) {
        log.info(" Import France Travail : motsCles='{}', commune='{}', max={}",
                motsCles, commune, maxResults);

        int limit = Math.min(maxResults, 150);
        String range = "0-" + (limit - 1);

        List<FranceTravailOfferDto> offers = client.searchOffers(motsCles, commune, range);

        int imported = 0;
        int skipped = 0;

        for (FranceTravailOfferDto dto : offers) {
            try {
                if (offerAlreadyExists(dto.getId())) {
                    skipped++;
                    continue;
                }

                JobOffer offer = mapToJobOffer(dto);
                jobOfferRepository.save(offer);
                imported++;

            } catch (Exception e) {
                log.warn(" Erreur lors de l'import de l'offre {} : {}", dto.getId(), e.getMessage());
            }
        }

        log.info(" Import terminé : {} nouvelles offres, {} doublons ignorés", imported, skipped);
        return imported;
    }

    private boolean offerAlreadyExists(String externalId) {
        return false;
    }


    private JobOffer mapToJobOffer(FranceTravailOfferDto dto) {
        return JobOffer.builder()
                .title(dto.getIntitule() != null ? dto.getIntitule() : "Sans titre")
                .company(extractCompany(dto))
                .location(extractLocation(dto))
                .sector(extractSector(dto))
                .contractType(mapContractType(dto.getTypeContrat()))
                .salaryMin(extractSalaryMin(dto))
                .salaryMax(extractSalaryMax(dto))
                .description(dto.getDescription())
                .requirements(extractRequirements(dto))
                .remote(false)
                .url(dto.getOrigineOffre() != null ? dto.getOrigineOffre().getUrlOrigine() : null)
                .source("France Travail")
                .isActive(true)
                .build();
    }

    private String extractCompany(FranceTravailOfferDto dto) {
        if (dto.getEntreprise() != null && dto.getEntreprise().getNom() != null) {
            return dto.getEntreprise().getNom();
        }
        return "Non renseignée";
    }

    private String extractLocation(FranceTravailOfferDto dto) {
        if (dto.getLieuTravail() != null) {
            return dto.getLieuTravail().getLibelle();
        }
        return null;
    }


    private String extractSector(FranceTravailOfferDto dto) {
        String secteur = dto.getSecteurActiviteLibelle();
        if (secteur == null) return "OTHER";

        secteur = secteur.toLowerCase();

        // Mapping simple par mots-clés
        if (secteur.contains("informatique") || secteur.contains("numérique")) return "TECH";
        if (secteur.contains("santé") || secteur.contains("médical")) return "HEALTH";
        if (secteur.contains("commerce") || secteur.contains("vente")) return "COMMERCE";
        if (secteur.contains("construction") || secteur.contains("btp")) return "BTP";
        if (secteur.contains("hôtel") || secteur.contains("restauration")) return "HOSPITALITY";
        if (secteur.contains("transport") || secteur.contains("logistique")) return "TRANSPORT";
        if (secteur.contains("industrie")) return "INDUSTRY";
        if (secteur.contains("communication") || secteur.contains("création")) return "COMMUNICATION";
        if (secteur.contains("agriculture")) return "AGRICULTURE";
        if (secteur.contains("banque") || secteur.contains("assurance")) return "BANKING";
        if (secteur.contains("éducation") || secteur.contains("formation")) return "EDUCATION";

        return "OTHER";
    }

    private ContractType mapContractType(String typeContrat) {
        if (typeContrat == null) return ContractType.CDI;

        return switch (typeContrat.toUpperCase()) {
            case "CDI" -> ContractType.CDI;
            case "CDD" -> ContractType.CDD;
            case "MIS" -> ContractType.INTERIM;
            case "STAGE"-> ContractType.STAGE;
            case "ALTERNANCE"->ContractType.ALTERNANCE;
            case "FRA" -> ContractType.FREELANCE;
            default -> ContractType.CDI;
        };
    }

    private BigDecimal extractSalaryMin(FranceTravailOfferDto dto) {
        if (dto.getSalaire() == null || dto.getSalaire().getLibelle() == null) {
            return null;
        }
        // Logique simple : on essaie d'extraire un nombre
        Matcher matcher = SALARY_PATTERN.matcher(dto.getSalaire().getLibelle());
        if (matcher.find()) {
            try {
                String number = matcher.group(1) + (matcher.group(2) != null ? matcher.group(2) : "");
                return new BigDecimal(number);
            } catch (NumberFormatException e) {
                return null;
            }
        }
        return null;
    }

    private BigDecimal extractSalaryMax(FranceTravailOfferDto dto) {
        return extractSalaryMin(dto);
    }


    private String extractRequirements(FranceTravailOfferDto dto) {
        if (dto.getCompetences() == null || dto.getCompetences().isEmpty()) {
            return null;
        }
        StringBuilder sb = new StringBuilder();
        for (FranceTravailOfferDto.CompetenceDto comp : dto.getCompetences()) {
            if (comp.getLibelle() != null) {
                if (sb.length() > 0) sb.append(", ");
                sb.append(comp.getLibelle());
            }
        }
        return sb.toString();
    }
}