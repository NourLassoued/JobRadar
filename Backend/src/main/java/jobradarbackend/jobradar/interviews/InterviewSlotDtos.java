package jobradarbackend.jobradar.interviews;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Future;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import jobradarbackend.jobradar.recruiter.RecruiterDtos.ApplicantResponse;

import java.time.LocalDateTime;
import java.util.List;

public final class InterviewSlotDtos {

    private InterviewSlotDtos() {}

    /** Un créneau saisi par le recruteur */
    public record SlotRequest(
            @NotNull @Future LocalDateTime startsAt,
            @Min(15) @Max(240) int durationMinutes,
            @NotNull InterviewSlot.Mode mode,
            @Size(max = 300) String location) {}

    /** Le recruteur propose 1 à 3 créneaux (avec un message facultatif) */
    public record ProposeRequest(
            @Size(max = 2000) String message,
            @NotEmpty @Size(max = 3) List<@Valid SlotRequest> slots) {}

    /** Le candidat propose un autre moment */
    public record CounterRequest(
            @NotNull @Future LocalDateTime startsAt,
            @Size(max = 1000) String message) {}

    /** Le recruteur accepte le moment proposé par le candidat (il précise le format) */
    public record ConfirmRequest(
            @NotNull InterviewSlot.Mode mode,
            @Size(max = 300) String location) {}

    public record SlotItem(
            Long id,
            LocalDateTime startsAt,
            LocalDateTime endsAt,
            int durationMinutes,
            InterviewSlot.Mode mode,
            String location,
            InterviewSlot.Author proposedBy,
            InterviewSlot.Status status,
            String message,
            LocalDateTime createdAt) {

        static SlotItem from(InterviewSlot s) {
            return new SlotItem(s.getId(), s.getStartsAt(), s.endsAt(), s.getDurationMinutes(), s.getMode(),
                    s.getLocation(), s.getProposedBy(), s.getStatus(), s.getMessage(), s.getCreatedAt());
        }
    }

    /**
     * Où en est la prise de rendez-vous :
     * NONE · WAITING_CANDIDATE (le candidat doit choisir) · WAITING_RECRUITER (le candidat a proposé un moment)
     * · CONFIRMED (entretien fixé)
     */
    public enum State { NONE, WAITING_CANDIDATE, WAITING_RECRUITER, CONFIRMED }

    /**
     * proposals : créneaux en attente de réponse ; confirmed : l'entretien fixé (ou null) ;
     * calendarUrl : lien « Ajouter à Google Agenda » de l'entretien fixé (titre adapté à qui le lit)
     */
    public record InterviewSlots(State state, List<SlotItem> proposals, SlotItem confirmed, String calendarUrl) {}

    /** applicant est rempli quand la candidature vient de passer à « Entretien » */
    public record ProposeResult(ApplicantResponse applicant, InterviewSlots slots) {}
}
