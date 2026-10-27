package jobradarbackend.jobradar.recruiter;

import jakarta.validation.Valid;
import jobradarbackend.jobradar.recruiter.RecruiterDtos.ApplicantResponse;
import jobradarbackend.jobradar.recruiter.RecruiterDtos.ApplicantStatusRequest;
import jobradarbackend.jobradar.recruiter.RecruiterDtos.CompanyRequest;
import jobradarbackend.jobradar.recruiter.RecruiterDtos.CompanyResponse;
import jobradarbackend.jobradar.recruiter.RecruiterDtos.JobPostRequest;
import jobradarbackend.jobradar.recruiter.RecruiterDtos.JobStatusRequest;
import jobradarbackend.jobradar.recruiter.RecruiterDtos.RecruiterJobResponse;
import jobradarbackend.jobradar.recruiter.RecruiterService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.security.Principal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;


@RestController
@RequestMapping("/api/recruiter")
@RequiredArgsConstructor
public class RecruiterController {

    private final RecruiterService service;
    private final CompanyLogoService logoService;   // ← AJOUTER CETTE LIGNE
    // ── Profil entreprise ────────────────────────────────────

    @GetMapping("/company")
    public CompanyResponse company(Principal principal) {
        return service.getCompany(principal);
    }

    @PutMapping("/company")
    public CompanyResponse saveCompany(@Valid @RequestBody CompanyRequest request, Principal principal) {
        return service.saveCompany(principal, request);
    }

    // ── Offres ───────────────────────────────────────────────

    @PostMapping("/jobs")
    @ResponseStatus(HttpStatus.CREATED)
    public RecruiterJobResponse createJob(@Valid @RequestBody JobPostRequest request, Principal principal) {
        return service.createJob(principal, request);
    }

    @GetMapping("/jobs")
    public List<RecruiterJobResponse> jobs(Principal principal) {
        return service.listJobs(principal);
    }

    @GetMapping("/jobs/{id}")
    public RecruiterJobResponse job(@PathVariable Long id, Principal principal) {
        return service.getJob(principal, id);
    }

    @PutMapping("/jobs/{id}")
    public RecruiterJobResponse updateJob(@PathVariable Long id, @Valid @RequestBody JobPostRequest request,
                                          Principal principal) {
        return service.updateJob(principal, id, request);
    }

    @PatchMapping("/jobs/{id}/status")
    public RecruiterJobResponse setJobStatus(@PathVariable Long id, @RequestBody JobStatusRequest request,
                                             Principal principal) {
        return service.setJobActive(principal, id, request.active());
    }

    // ── Candidats ────────────────────────────────────────────

    @GetMapping("/jobs/{id}/applicants")
    public List<ApplicantResponse> applicants(@PathVariable Long id, Principal principal) {
        return service.listApplicants(principal, id);
    }

    @PatchMapping("/applications/{id}/status")
    public ApplicantResponse updateApplicantStatus(@PathVariable Long id,
                                                   @Valid @RequestBody ApplicantStatusRequest request,
                                                   Principal principal) {
        return service.updateApplicantStatus(principal, id, request.status());
    }

    // ── Erreurs en JSON lisible par le front : { status, message, fields? } ──

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, Object>> handleStatus(ResponseStatusException e) {
        return ResponseEntity.status(e.getStatusCode())
                .body(Map.of("status", e.getStatusCode().value(), "message", String.valueOf(e.getReason())));
    }

    /** Formulaire invalide : un message par champ, affiché sous le champ côté Angular */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidation(MethodArgumentNotValidException e) {
        Map<String, String> fields = new LinkedHashMap<>();
        for (FieldError error : e.getBindingResult().getFieldErrors()) {
            fields.putIfAbsent(error.getField(), error.getDefaultMessage());
        }
        return ResponseEntity.badRequest().body(Map.of(
                "status", 400,
                "message", "Certains champs sont invalides.",
                "fields", fields));
    }
    @PostMapping(path = "/company/logo", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Map<String, String> uploadLogo(@RequestParam("file") MultipartFile file, Principal principal) {
        return Map.of("url", logoService.upload(service.currentUserId(principal), file));
    }
}