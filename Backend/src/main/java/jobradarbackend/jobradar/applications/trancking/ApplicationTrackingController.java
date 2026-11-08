package jobradarbackend.jobradar.applications.trancking;

import jakarta.validation.Valid;
import jobradarbackend.jobradar.applications.trancking.ApplicationTrackingService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import jobradarbackend.jobradar.applications.trancking.TrackingDtos.*;

import java.security.Principal;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;


@RestController
@RequestMapping("/api/tracking/applications")
public class ApplicationTrackingController {

    private final ApplicationTrackingService service;

    public ApplicationTrackingController(ApplicationTrackingService service) {
        this.service = service;
    }

    @GetMapping
    public List<ApplicationCard> board(Principal principal) {
        return service.board(principal);
    }

    @GetMapping("/stats")
    public Stats stats(Principal principal) {
        return service.stats(principal);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApplicationCard create(@Valid @RequestBody CreateRequest request, Principal principal) {
        return service.create(principal, request);
    }

    @GetMapping("/{id}")
    public ApplicationDetail detail(@PathVariable Long id, Principal principal) {
        return service.detail(principal, id);
    }

    @PatchMapping("/{id}")
    public ApplicationDetail update(@PathVariable Long id, @Valid @RequestBody UpdateRequest request, Principal principal) {
        return service.update(principal, id, request);
    }

    @PatchMapping("/{id}/status")
    public ApplicationCard move(@PathVariable Long id, @Valid @RequestBody MoveRequest request, Principal principal) {
        return service.move(principal, id, request.status());
    }

    @PutMapping("/{id}/follow-up")
    public ApplicationDetail followUp(@PathVariable Long id, @RequestBody FollowUpRequest request, Principal principal) {
        return service.setFollowUp(principal, id, request.followUpAt());
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id, Principal principal) {
        service.delete(principal, id);
    }

    @PostMapping("/{id}/notes")
    @ResponseStatus(HttpStatus.CREATED)
    public NoteItem addNote(@PathVariable Long id, @Valid @RequestBody NoteRequest request, Principal principal) {
        return service.addNote(principal, id, request.content());
    }

    @DeleteMapping("/{id}/notes/{noteId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteNote(@PathVariable Long id, @PathVariable Long noteId, Principal principal) {
        service.deleteNote(principal, id, noteId);
    }

    @PostMapping("/{id}/activities")
    @ResponseStatus(HttpStatus.CREATED)
    public ActivityItem addActivity(@PathVariable Long id, @Valid @RequestBody ActivityRequest request, Principal principal) {
        return service.addActivity(principal, id, request);
    }

    @PatchMapping("/{id}/activities/{activityId}")
    public ActivityItem setActivityDone(@PathVariable Long id, @PathVariable Long activityId,
                                        @RequestBody ActivityDoneRequest request, Principal principal) {
        return service.setActivityDone(principal, id, activityId, request.done());
    }

    @DeleteMapping("/{id}/activities/{activityId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteActivity(@PathVariable Long id, @PathVariable Long activityId, Principal principal) {
        service.deleteActivity(principal, id, activityId);
    }

    // ── Erreurs : toujours { status, message } pour le front ──

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, Object>> handleStatus(ResponseStatusException e) {
        return ResponseEntity.status(e.getStatusCode())
                .body(Map.of("status", e.getStatusCode().value(), "message", String.valueOf(e.getReason())));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidation(MethodArgumentNotValidException e) {
        String message = e.getBindingResult().getFieldErrors().stream()
                .map(FieldError::getField)
                .distinct()
                .collect(Collectors.joining(", "));
        return ResponseEntity.badRequest()
                .body(Map.of("status", 400, "message", "Champs invalides : " + message + "."));
    }
}
