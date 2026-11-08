package jobradarbackend.jobradar.joboffer.quality;

import jobradarbackend.jobradar.joboffer.JobOffer;
import jobradarbackend.jobradar.joboffer.JobOfferRepository;
import jobradarbackend.jobradar.joboffer.quality.OfferQualityAnalyzer.Assessment;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.stream.Collectors;

/**
 * Contrôle des offres importées (France Travail, Adzuna, Jooble) :
 *  1. note de qualité de chaque offre (OfferQualityAnalyzer) ;
 *  2. détection des doublons : la même offre publiée sur plusieurs sites ;
 *  3. on garde la meilleure version de chaque doublon et on masque les autres (is_active = false),
 *     ainsi que les offres de très mauvaise qualité (note < offer-quality.min-score).
 *
 * Les offres publiées par les recruteurs sur JobRadar ne sont JAMAIS touchées.
 * Une offre masquée par ce contrôle est réactivée automatiquement si elle n'est plus en cause.
 * Lancement : toutes les 6 h (30 min après l'import France Travail), ou à la demande (admin).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class OfferQualityService {

    private static final int MAX_DESCRIPTION_CHARS = 2_000;
    /** Au-delà, un groupe (même entreprise) n'est comparé que sur ses premières offres */
    private static final int MAX_BLOCK_SIZE = 400;
    private static final int REPORT_SAMPLE = 50;

    private final JobOfferRepository offers;
    private final OfferQualityRepository qualities;
    private final TransactionTemplate tx;

    @Value("${offer-quality.min-score:25}")
    private int minScore;

    @Value("${offer-quality.enabled:true}")
    private boolean enabled;

    private final AtomicBoolean running = new AtomicBoolean(false);
    private volatile QualityReport lastReport;

    // ── Rapport renvoyé à l'admin ────────────────────────────

    public record FlaggedOffer(Long id, String title, String company, String source, int score,
                               List<String> issues, Long duplicateOf, boolean hidden) {}

    public record QualityReport(LocalDateTime ranAt, long durationMs, int analyzed, int duplicateGroups,
                                int hiddenDuplicates, int hiddenLowQuality, int restored, int averageScore,
                                Map<String, Long> issues, List<FlaggedOffer> flagged) {}

    /** Version d'une offre préparée pour la comparaison */
    private record Item(JobOffer offer, Assessment quality, Set<String> titleWords, Set<String> shingles,
                        String companyKey, String cityKey) {}

    @Scheduled(cron = "${offer-quality.cron:0 30 */6 * * *}")
    public void scheduledRun() {
        if (!enabled) return;
        try {
            run();
        } catch (RuntimeException e) {
            log.error("Contrôle qualité des offres en échec : {}", e.getMessage(), e);
        }
    }

    public Optional<QualityReport> lastReport() {
        return Optional.ofNullable(lastReport);
    }

    /** Une seule transaction : les offres masquées / réactivées sont enregistrées avec le rapport */
    public QualityReport run() {
        if (!running.compareAndSet(false, true)) {
            throw new IllegalStateException("Un contrôle est déjà en cours.");
        }
        try {
            return tx.execute(status -> doRun());
        } finally {
            running.set(false);
        }
    }

    private QualityReport doRun() {
        long start = System.currentTimeMillis();
        LocalDateTime now = LocalDateTime.now();

        // Offres importées actives + celles que ce contrôle avait masquées (à réévaluer)
        Map<Long, OfferQuality> previous = qualities.findAll().stream()
                .collect(Collectors.toMap(OfferQuality::getOfferId, q -> q));
        Set<Long> previouslyHidden = previous.values().stream()
                .filter(OfferQuality::isHiddenByCheck).map(OfferQuality::getOfferId).collect(Collectors.toSet());

        Map<Long, JobOffer> pool = new LinkedHashMap<>();
        for (JobOffer o : offers.findByIsActiveTrue()) if (o.getPublisher() == null) pool.put(o.getId(), o);
        for (JobOffer o : offers.findAllById(previouslyHidden)) if (o.getPublisher() == null) pool.putIfAbsent(o.getId(), o);

        List<Item> items = pool.values().stream().map(OfferQualityService::prepare).toList();

        // ── Doublons : comparaison à l'intérieur de groupes (même entreprise, sinon même intitulé) ──
        Map<String, List<Item>> blocks = new HashMap<>();
        for (Item it : items) blocks.computeIfAbsent(blockKey(it), k -> new ArrayList<>()).add(it);

        UnionFind groups = new UnionFind();
        for (List<Item> block : blocks.values()) {
            int n = Math.min(block.size(), MAX_BLOCK_SIZE);
            for (int i = 0; i < n; i++) {
                for (int j = i + 1; j < n; j++) {
                    if (isDuplicate(block.get(i), block.get(j))) {
                        groups.union(block.get(i).offer().getId(), block.get(j).offer().getId());
                    }
                }
            }
        }

        Map<Long, Item> byId = items.stream().collect(Collectors.toMap(i -> i.offer().getId(), i -> i));
        Map<Long, List<Item>> clusters = new HashMap<>();
        for (Item it : items) {
            Long root = groups.find(it.offer().getId());
            if (root != null) clusters.computeIfAbsent(root, k -> new ArrayList<>()).add(it);
        }

        // Dans chaque groupe : on garde la meilleure version
        Map<Long, Long> duplicateOf = new HashMap<>();
        int duplicateGroups = 0;
        for (List<Item> cluster : clusters.values()) {
            if (cluster.size() < 2) continue;
            duplicateGroups++;
            Item keeper = cluster.stream().max(KEEPER_ORDER).orElseThrow();
            for (Item it : cluster) {
                if (it != keeper) duplicateOf.put(it.offer().getId(), keeper.offer().getId());
            }
        }

        // ── Décisions et enregistrement ──
        int hiddenDup = 0, hiddenLow = 0, restored = 0;
        long totalScore = 0;
        Map<String, Long> issueCounts = new TreeMap<>();
        List<FlaggedOffer> flagged = new ArrayList<>();
        List<OfferQuality> toSave = new ArrayList<>();

        for (Item it : items) {
            JobOffer offer = it.offer();
            Long id = offer.getId();
            Long dupOf = duplicateOf.get(id);
            boolean lowQuality = it.quality().score() < minScore;
            boolean shouldHide = dupOf != null || lowQuality;
            boolean wasHidden = previouslyHidden.contains(id);

            List<String> issues = new ArrayList<>(it.quality().issues());
            if (dupOf != null) issues.add(0, "Doublon de l'offre " + dupOf);

            if (shouldHide) {
                if (Boolean.TRUE.equals(offer.getIsActive())) offer.setIsActive(false);
                if (dupOf != null) hiddenDup++;
                else hiddenLow++;
            } else if (wasHidden && !Boolean.TRUE.equals(offer.getIsActive())) {
                offer.setIsActive(true); // plus de raison de la masquer
                restored++;
            }

            OfferQuality q = previous.getOrDefault(id, OfferQuality.builder().offerId(id).build());
            q.setScore(it.quality().score());
            q.setIssues(String.join("|", issues));
            q.setDuplicateOf(dupOf);
            q.setHiddenByCheck(shouldHide);
            q.setCheckedAt(now);
            toSave.add(q);

            totalScore += it.quality().score();
            issues.forEach(i -> issueCounts.merge(i.startsWith("Doublon") ? "Doublon" : i, 1L, Long::sum));
            if (shouldHide || it.quality().suspicious() || it.quality().score() < 60) {
                flagged.add(new FlaggedOffer(id, offer.getTitle(), offer.getCompany(), offer.getSource(),
                        it.quality().score(), issues, dupOf, shouldHide));
            }
        }
        qualities.saveAll(toSave);

        flagged.sort(Comparator.comparing(FlaggedOffer::hidden).reversed().thenComparingInt(FlaggedOffer::score));
        QualityReport report = new QualityReport(now, System.currentTimeMillis() - start, items.size(), duplicateGroups,
                hiddenDup, hiddenLow, restored, items.isEmpty() ? 0 : (int) (totalScore / items.size()),
                issueCounts, flagged.stream().limit(REPORT_SAMPLE).toList());
        lastReport = report;
        log.info("Contrôle qualité : {} offres, {} groupes de doublons, {} doublons masqués, {} offres faibles masquées, {} réactivées ({} ms)",
                report.analyzed(), duplicateGroups, hiddenDup, hiddenLow, restored, report.durationMs());
        return report;
    }

    // ── Règles de comparaison ────────────────────────────────

    private static Item prepare(JobOffer o) {
        return new Item(o, OfferQualityAnalyzer.assess(o),
                OfferTextSimilarity.words(o.getTitle()),
                OfferTextSimilarity.shingles(o.getDescription(), MAX_DESCRIPTION_CHARS),
                OfferTextSimilarity.companyKey(o.getCompany()),
                OfferTextSimilarity.cityKey(o.getLocation()));
    }

    /** Même entreprise ; sans entreprise connue, les 3 mots les plus longs de l'intitulé */
    private static String blockKey(Item it) {
        if (!it.companyKey().isEmpty()) return "c:" + it.companyKey();
        return "t:" + it.titleWords().stream().sorted(Comparator.comparingInt(String::length).reversed()
                .thenComparing(Comparator.naturalOrder())).limit(3).sorted().collect(Collectors.joining(" "));
    }

    static boolean isDuplicate(Item a, Item b) {
        // Deux villes différentes : deux postes différents (sauf texte presque identique)
        boolean sameCity = a.cityKey().isEmpty() || b.cityKey().isEmpty() || a.cityKey().equals(b.cityKey());
        double title = OfferTextSimilarity.jaccard(a.titleWords(), b.titleWords());
        boolean comparableTexts = a.shingles().size() >= 10 && b.shingles().size() >= 10;
        double text = comparableTexts ? OfferTextSimilarity.jaccard(a.shingles(), b.shingles()) : 0;

        if (!sameCity) return text >= 0.9;
        if (title >= 0.85 && (text >= 0.3 || !comparableTexts)) return true;
        if (title >= 0.6 && text >= 0.6) return true;
        return text >= 0.85;
    }

    /** La version conservée : meilleure note, puis salaire indiqué, puis description plus longue, puis plus récente */
    private static final Comparator<Item> KEEPER_ORDER = Comparator
            .comparingInt((Item i) -> i.quality().score())
            .thenComparing(i -> i.offer().getSalaryMin() != null || i.offer().getSalaryMax() != null)
            .thenComparingInt(i -> i.offer().getDescription() == null ? 0 : i.offer().getDescription().length())
            .thenComparing(i -> Objects.requireNonNullElse(i.offer().getUpdatedAt(),
                    Objects.requireNonNullElse(i.offer().getCreatedAt(), LocalDateTime.MIN)))
            .thenComparing(i -> -i.offer().getId());

    /** Regroupe les offres reliées : si A = B et B = C, alors A, B et C forment un seul groupe */
    private static final class UnionFind {
        private final Map<Long, Long> parent = new HashMap<>();

        Long find(Long x) {
            Long p = parent.get(x);
            if (p == null) return null;
            if (!p.equals(x)) {
                p = find(p);
                parent.put(x, p);
            }
            return p;
        }

        void union(Long a, Long b) {
            parent.putIfAbsent(a, a);
            parent.putIfAbsent(b, b);
            Long ra = find(a), rb = find(b);
            if (!ra.equals(rb)) parent.put(ra, rb);
        }
    }
}
