# JobRadar - backend Spring Boot 3.2 / Java 21 (multi-stage)

# --- Étape 1 : build ---
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app
COPY pom.xml .
RUN mvn -q -B dependency:go-offline
COPY src ./src
RUN mvn -q -B package -DskipTests

# --- Étape 2 : image d'exécution légère ---
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
RUN addgroup -S app && adduser -S app -G app
COPY --from=build /app/target/*.jar app.jar
USER app
EXPOSE 8080
# La configuration (application.properties) est montée dans /app/config/ par Kubernetes :
# Spring Boot la charge automatiquement depuis ./config/
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75", "-jar", "app.jar"]
