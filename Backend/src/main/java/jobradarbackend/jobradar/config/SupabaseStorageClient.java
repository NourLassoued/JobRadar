package jobradarbackend.jobradar.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.UUID;

@Slf4j
@Component
public class SupabaseStorageClient {

    @Value("${supabase.url}")
    private String supabaseUrl;

    @Value("${supabase.key}")
    private String supabaseKey;

    private final HttpClient httpClient = HttpClient.newHttpClient();

    public String uploadFile(String bucket, MultipartFile file) throws IOException {
        String fileName = generateFileName(file.getOriginalFilename());
        String uploadUrl = supabaseUrl + "/storage/v1/object/" + bucket + "/" + fileName;

        log.info("⬆️ Uploading to: {}", uploadUrl);
        log.info("🔑 Using key: {}", supabaseKey.substring(0, 20) + "...");
        log.info("📦 File size: {} bytes", file.getSize());

        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(uploadUrl))
                    .header("Authorization", "Bearer " + supabaseKey)
                    .header("Content-Type", file.getContentType() != null ? file.getContentType() : "application/octet-stream")
                    .POST(HttpRequest.BodyPublishers.ofByteArray(file.getBytes()))
                    .build();

            log.info("🚀 Sending request...");
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            log.info("📊 Response status: {}", response.statusCode());
            if (!response.body().isEmpty()) {
                log.info("📝 Response body: {}", response.body());
            }

            if (response.statusCode() >= 200 && response.statusCode() < 300) {
                String publicUrl = supabaseUrl + "/storage/v1/object/public/" + bucket + "/" + fileName;
                log.info("✅ Upload success: {}", publicUrl);
                return publicUrl;
            } else {
                log.error("❌ Upload failed with status {}: {}", response.statusCode(), response.body());
                throw new IOException("Upload failed with status " + response.statusCode());
            }

        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            log.error("⚠️ Upload interrupted: {}", e.getMessage());
            throw new IOException("Upload interrupted", e);
        } catch (Exception e) {
            log.error("❌ Error uploading file: {}", e.getMessage(), e);
            throw new IOException("Error uploading file: " + e.getMessage());
        }
    }

    public void deleteFile(String bucket, String fileName) throws IOException {
        String deleteUrl = supabaseUrl + "/storage/v1/object/" + bucket + "/" + fileName;
        log.info("🗑️ Deleting: {}", deleteUrl);

        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(deleteUrl))
                    .header("Authorization", "Bearer " + supabaseKey)
                    .DELETE()
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            log.info("✅ Delete response status: {}", response.statusCode());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            log.error("⚠️ Delete interrupted: {}", e.getMessage());
        } catch (Exception e) {
            log.error("❌ Error deleting file: {}", e.getMessage());
        }
    }

    public String extractFileNameFromUrl(String url) {
        if (url == null || url.isEmpty()) return null;
        return url.substring(url.lastIndexOf("/") + 1);
    }

    private String generateFileName(String originalFileName) {
        String uuid = UUID.randomUUID().toString().substring(0, 8);
        long timestamp = System.currentTimeMillis();
        String extension = getFileExtension(originalFileName);
        return uuid + "_" + timestamp + "." + extension;
    }

    private String getFileExtension(String fileName) {
        if (fileName == null || !fileName.contains(".")) return "unknown";
        return fileName.substring(fileName.lastIndexOf(".") + 1).toLowerCase();
    }
}