package jobradarbackend.jobradar.applications;

import jobradarbackend.jobradar.Mail.HtmlMail;
import jobradarbackend.jobradar.Mail.HtmlMailer;
import jobradarbackend.jobradar.candidate.Candidate;
import jobradarbackend.jobradar.joboffer.JobOffer;

import jobradarbackend.jobradar.recruiter.Company;
import jobradarbackend.jobradar.user.User;
import org.springframework.stereotype.Component;

@Component
public class ApplicationMailer {

    private final HtmlMailer mailer;

    public ApplicationMailer(HtmlMailer mailer) {
        this.mailer = mailer;
    }

    /** Au recruteur : e-mail de contact de l'entreprise, sinon celui du compte propriétaire */
    public void applicationReceived(Candidate candidate, JobOffer offer, int score) {
        Company company = offer.getPublisher();
        if (company == null) return;
        User owner = company.getOwner();
        String to = firstNonBlank(company.getContactEmail(), owner != null ? owner.getEmail() : null);
        String name = fullName(candidate);

        mailer.send(new HtmlMail()
                .to(to)
                .subject("Nouvelle candidature — " + offer.getTitle())
                .label("Nouvelle candidature")
                .headline(name + " a postulé à votre offre")
                .greeting(owner != null ? owner.getFirstName() : null)
                .intro("Une nouvelle candidature vient d'arriver pour le poste « " + offer.getTitle() + " ». "
                        + "Le CV et la lettre de motivation sont disponibles dans votre espace.")
                .card("Candidat", name, offer.getTitle())
                .highlight("Compatibilité " + score + " %")
                .steps("Consultez son CV et sa lettre de motivation.",
                        "Répondez-lui depuis votre espace : entretien, proposition ou refus. Il sera prévenu tout de suite.")
                .cta("Voir la candidature", "/app/recruteur/offres/" + offer.getId() + "/candidats")
                .footer("Vous recevez cet e-mail car vous avez publié cette offre sur JobRadar."));
    }

    /** Au candidat : confirmation que sa candidature est partie */
    public void applicationSent(Candidate candidate, JobOffer offer, int score) {
        String to = firstNonBlank(candidate.getEmail(), candidate.getUser() != null ? candidate.getUser().getEmail() : null);
        String company = offer.getPublisher() != null ? offer.getPublisher().getName() : offer.getCompany();

        mailer.send(new HtmlMail()
                .to(to)
                .subject("Candidature envoyée — " + offer.getTitle())
                .label("Candidature envoyée")
                .colors("#15803d", "#e7f6ec")
                .headline("Votre candidature a bien été envoyée")
                .greeting(candidate.getFirstName())
                .intro(company + " a bien reçu votre CV et votre lettre de motivation pour le poste « "
                        + offer.getTitle() + " ».")
                .card("Offre", offer.getTitle(), company)
                .highlight("Compatibilité " + score + " %")
                .steps("Le recruteur étudie votre candidature.",
                        "Vous serez prévenu(e) par e-mail et dans JobRadar dès qu'il répond.")
                .cta("Suivre ma candidature", "/app/candidatures")
                .footer("Vous recevez cet e-mail car vous avez postulé via JobRadar."));
    }

    private static String fullName(Candidate c) {
        String n = ((c.getFirstName() == null ? "" : c.getFirstName()) + " "
                + (c.getLastName() == null ? "" : c.getLastName())).strip();
        return n.isEmpty() ? "Un candidat" : n;
    }

    private static String firstNonBlank(String a, String b) {
        return a != null && !a.isBlank() ? a : b;
    }
}
