package jobradarbackend.jobradar.applications;

import jobradarbackend.jobradar.user.User;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class ApplicationEventService {

    private final ApplicationEventRepository repository;

    public ApplicationEventService(ApplicationEventRepository repository) {
        this.repository = repository;
    }

    @Transactional
    public ApplicationEvent record(Application application, ApplicationStatus from, ApplicationStatus to,
                                   String message, User actor, String actorRole) {
        ApplicationEvent e = new ApplicationEvent();
        e.setApplication(application);
        e.setFromStatus(from);
        e.setToStatus(to);
        e.setMessage(message == null || message.isBlank() ? null : message.strip());
        e.setActor(actor);
        e.setActorRole(actorRole);
        return repository.save(e);
    }

    @Transactional(readOnly = true)
    public List<ApplicationEvent> history(Long applicationId) {
        return repository.findByApplicationIdOrderByCreatedAtAsc(applicationId);
    }
}