package jobradarbackend.jobradar.matching.recommendation;

import jobradarbackend.jobradar.matching.OfferTextAnalyzer;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;


public final class SkillDictionary {

    /** Nom affiché → synonymes normalisés (le nom lui-même compris) */
    private static final Map<String, List<String>> SKILLS = new LinkedHashMap<>();
    /** Synonyme normalisé → nom affiché */
    private static final Map<String, String> ALIASES = new LinkedHashMap<>();
    /** Motif « mot entier » précompilé pour chaque synonyme */
    private static final Map<String, Pattern> PATTERNS = new LinkedHashMap<>();

    static {
        // Langages
        add("Java");
        add("JavaScript", "es6");          // pas « js » seul : il apparaît dans « Node.js », « Next.js »…
        add("TypeScript");
        add("Python");
        add("PHP");
        add("C#", "csharp", "c sharp");
        add("C++", "cpp");
        add("Kotlin");
        add("Swift");
        add("Dart");
        add("Golang");
        add("Rust");
        add("Scala");
        add("Ruby");
        add("SQL");
        add("HTML", "html5");
        add("CSS", "css3");

        // Frameworks back
        add("Spring Boot", "spring-boot", "springboot", "spring");
        add("Hibernate", "jpa");
        add("Node.js", "nodejs", "node js", "node");
        add("NestJS", "nest.js");
        add("Express.js", "expressjs");
        add("Django");
        add("Flask");
        add("FastAPI");
        add("Symfony");
        add("Laravel");
        add(".NET", "dotnet", "asp.net", ".net core");
        add("Ruby on Rails", "rails");

        // Frameworks front et mobile
        add("Angular", "angularjs");
        add("React", "reactjs", "react.js");
        add("Next.js", "nextjs");
        add("Vue.js", "vuejs");
        add("Tailwind CSS", "tailwind");
        add("Flutter");
        add("React Native");
        add("Android");
        add("iOS");

        // Bases de données et messagerie
        add("PostgreSQL", "postgres", "postgre");
        add("MySQL", "mariadb");
        add("Oracle");
        add("MongoDB", "mongo");
        add("Redis");
        add("Elasticsearch", "elastic search");
        add("Kafka");
        add("RabbitMQ");

        // API et sécurité
        add("API REST", "rest api", "restful", "api rest");
        add("GraphQL");
        add("gRPC");
        add("WebSocket", "websockets", "socket.io");
        add("Microservices", "micro-services", "microservice");
        add("JWT");
        add("OAuth2", "oauth 2", "oauth");

        // DevOps et cloud
        add("Docker");
        add("Kubernetes", "k8s");
        add("Helm");
        add("Terraform");
        add("Ansible");
        add("Jenkins");
        add("GitLab CI", "gitlab-ci", "gitlab");
        add("GitHub Actions");
        add("CI/CD", "ci cd", "integration continue");
        add("ArgoCD", "argo cd");
        add("AWS", "amazon web services");
        add("Azure");
        add("GCP", "google cloud");
        add("Linux");
        add("Git");
        add("Nginx");
        add("Prometheus");
        add("Grafana");
        add("DevOps");

        // Tests et qualité
        add("JUnit");
        add("Selenium");
        add("Cypress");
        add("Jest");
        add("SonarQube", "sonar");

        // Data et IA
        add("Spark", "apache spark");
        add("Hadoop");
        add("Power BI", "powerbi");
        add("TensorFlow");
        add("PyTorch");
        add("Machine Learning", "apprentissage automatique");

        // Outils et méthodes
        add("Jira");
        add("Figma");
        add("Scrum");
        add("UML");
        add("SAP");
        add("Salesforce");
        add("Excel");
    }

    private SkillDictionary() {
    }

    private static void add(String name, String... synonyms) {
        List<String> all = new ArrayList<>();
        all.add(OfferTextAnalyzer.normalize(name));
        for (String s : synonyms) all.add(OfferTextAnalyzer.normalize(s));
        SKILLS.put(name, Collections.unmodifiableList(all));
        for (String alias : all) {
            ALIASES.putIfAbsent(alias, name);
            PATTERNS.computeIfAbsent(alias, OfferTextAnalyzer::wholeWord);
        }
    }

    /** « postgres », « PostgreSQL » → « PostgreSQL » ; compétence inconnue → vide */
    public static Optional<String> canonical(String skill) {
        if (skill == null) return Optional.empty();
        return Optional.ofNullable(ALIASES.get(OfferTextAnalyzer.normalize(skill)));
    }

    /** La technologie (nom affiché) est-elle citée dans le texte, sous un de ses noms ? */
    public static boolean mentions(String normalizedText, String canonicalName) {
        return firstIndex(normalizedText, canonicalName) >= 0;
    }

    /**
     * Technologies citées dans le texte, dans leur ordre d'apparition.
     * Ex. « Node.js, React et Postgres » → [Node.js, React, PostgreSQL]
     */
    public static List<String> detect(String normalizedText) {
        if (normalizedText == null || normalizedText.isEmpty()) return List.of();
        Map<String, Integer> found = new LinkedHashMap<>();
        for (String name : SKILLS.keySet()) {
            int index = firstIndex(normalizedText, name);
            if (index >= 0) found.put(name, index);
        }
        return found.entrySet().stream()
                .sorted(Map.Entry.comparingByValue())
                .map(Map.Entry::getKey)
                .toList();
    }

    /** Position de la première mention de la technologie, -1 si absente */
    private static int firstIndex(String normalizedText, String canonicalName) {
        int best = -1;
        for (String alias : SKILLS.getOrDefault(canonicalName, List.of())) {
            Matcher m = PATTERNS.get(alias).matcher(normalizedText);
            if (m.find() && (best < 0 || m.start() < best)) best = m.start();
        }
        return best;
    }
}