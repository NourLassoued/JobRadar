package jobradarbackend.jobradar.documents;

import jobradarbackend.jobradar.documents.DocumentDtos.CoverLetterResponse;
import jobradarbackend.jobradar.documents.DocumentDtos.UploadedFileResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.security.Principal;
import java.util.List;
import java.util.Map;


@RestController
@RequestMapping("/api/documents")
public class DocumentController {

    private final DocumentService service;

    public DocumentController(DocumentService service) {
        this.service = service;
    }

    @PostMapping(path = "/cv-file", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public UploadedFileResponse uploadCvFile(@RequestParam("file") MultipartFile file, Principal principal) {
        return service.uploadCvFile(principal, file);
    }

    @GetMapping("/cover-letters")
    public List<CoverLetterResponse> listCoverLetters(Principal principal) {
        return service.listCoverLetters(principal);
    }

    @PostMapping(path = "/cover-letters", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public CoverLetterResponse uploadCoverLetter(@RequestParam("file") MultipartFile file,
                                                 @RequestParam(value = "title", required = false) String title,
                                                 Principal principal) {
        return service.uploadCoverLetter(principal, file, title);
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, Object>> handleStatus(ResponseStatusException e) {
        return ResponseEntity.status(e.getStatusCode())
                .body(Map.of("status", e.getStatusCode().value(), "message", String.valueOf(e.getReason())));
    }
}
