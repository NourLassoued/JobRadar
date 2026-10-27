package jobradarbackend.jobradar.recruiter;

import jobradarbackend.jobradar.joboffer.ContractType;
import jobradarbackend.jobradar.joboffer.JobOffer;
import jobradarbackend.jobradar.recruiter.RecruiterDtos.JobPostRequest;
import jobradarbackend.jobradar.recruiter.RecruiterDtos.RecruiterJobResponse;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.UUID;


@Component
public class RecruiterJobMapper {

    /** Source des offres publiées directement sur JobRadar */
    public static final String SOURCE = "JOBRADAR";

    static final String SKILLS_MARKER = "Compétences recherchées : ";
    static final String EXPERIENCE_MARKER = "Expérience demandée : ";
    static final String BEGINNER_TEXT = "débutant accepté";

    /** Remplit une offre (nouvelle ou existante) à partir du formulaire du recruteur */
    public void apply(JobPostRequest req, Company company, JobOffer target) {
        if (target.getId() == null) {
            target.setExternalId(SOURCE + "-" + UUID.randomUUID());
            target.setIsActive(true);
        }
        target.setSource(SOURCE);
        target.setPublisher(company);
        target.setCompany(company.getName());

        target.setTitle(req.title().strip());
        target.setDescription(req.description().strip());
        target.setRequirements(buildRequirements(req.requirements(), req.skills(), req.experienceYears()));
        target.setLocation(req.location().strip());
        target.setContractType(contractTypeOrNull(req.contractType()));
        target.setRemote(req.remote());
        target.setSalaryMin(money(req.salaryMin()));
        target.setSalaryMax(money(req.salaryMax()));
        // Secteur stocké sous forme de nom d'enum (« TECH »), comme pour France Travail et Adzuna
        target.setSector(req.sector().name());
    }

    public RecruiterJobResponse toResponse(JobOffer offer, long applicantsCount) {
        ParsedRequirements parsed = parseRequirements(offer.getRequirements());
        return new RecruiterJobResponse(
                offer.getId(),
                offer.getTitle(),
                offer.getDescription(),
                parsed.text(),
                offer.getLocation(),
                offer.getContractType() == null ? null : offer.getContractType().name(),
                // ⚠ Si votre champ est « boolean remote » (primitif), remplacez par offer.isRemote()
                Boolean.TRUE.equals(offer.getRemote()),
                toInt(offer.getSalaryMin()),
                toInt(offer.getSalaryMax()),
                offer.getSector(),
                parsed.skills(),
                parsed.experienceYears(),
                Boolean.TRUE.equals(offer.getIsActive()),
                offer.getCreatedAt(),
                applicantsCount);
    }

    // ── Texte « requirements » ───────────────────────────────

    /** Texte libre + « Compétences recherchées : … » + « Expérience demandée : N ans » */
    static String buildRequirements(String text, List<String> skills, Integer experienceYears) {
        List<String> parts = new ArrayList<>();
        if (text != null && !text.isBlank()) parts.add(text.strip());

        List<String> cleanSkills = skills == null ? List.of() : skills.stream()
                .filter(s -> s != null && !s.isBlank())
                .map(String::strip)
                .distinct()
                .toList();
        if (!cleanSkills.isEmpty()) parts.add(SKILLS_MARKER + String.join(", ", cleanSkills));

        if (experienceYears != null) {
            parts.add(EXPERIENCE_MARKER + (experienceYears == 0 ? BEGINNER_TEXT
                    : experienceYears + (experienceYears > 1 ? " ans" : " an")));
        }
        return parts.isEmpty() ? null : String.join("\n\n", parts);
    }

    record ParsedRequirements(String text, List<String> skills, Integer experienceYears) {}

    /** Inverse de buildRequirements : sépare le texte libre des deux lignes repères */
    static ParsedRequirements parseRequirements(String requirements) {
        if (requirements == null || requirements.isBlank()) return new ParsedRequirements(null, List.of(), null);

        List<String> skills = List.of();
        Integer years = null;
        List<String> kept = new ArrayList<>();
        for (String block : requirements.split("\n\n")) {
            String b = block.strip();
            if (b.startsWith(SKILLS_MARKER)) {
                skills = Arrays.stream(b.substring(SKILLS_MARKER.length()).split(","))
                        .map(String::strip).filter(s -> !s.isEmpty()).toList();
            } else if (b.startsWith(EXPERIENCE_MARKER)) {
                String value = b.substring(EXPERIENCE_MARKER.length()).strip();
                years = value.startsWith(BEGINNER_TEXT) ? 0 : parseLeadingInt(value);
            } else if (!b.isEmpty()) {
                kept.add(b);
            }
        }
        return new ParsedRequirements(kept.isEmpty() ? null : String.join("\n\n", kept), skills, years);
    }

    // ── Conversions ──────────────────────────────────────────

    /** « cdi », « CDI » → ContractType.CDI ; valeur inconnue → null (comme AdzunaMapper) */
    static ContractType contractTypeOrNull(String name) {
        if (name == null) return null;
        String n = name.strip().toUpperCase(Locale.ROOT);
        for (ContractType value : ContractType.values()) {
            if (value.name().equals(n)) return value;
        }
        return null;
    }

    private static BigDecimal money(Integer value) {
        return value == null || value <= 0 ? null : BigDecimal.valueOf(value);
    }

    private static Integer toInt(BigDecimal value) {
        return value == null ? null : value.intValue();
    }

    private static Integer parseLeadingInt(String value) {
        StringBuilder digits = new StringBuilder();
        for (char c : value.toCharArray()) {
            if (Character.isDigit(c)) digits.append(c);
            else break;
        }
        return digits.isEmpty() ? null : Integer.parseInt(digits.toString());
    }
}