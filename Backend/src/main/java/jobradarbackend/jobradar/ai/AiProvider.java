package jobradarbackend.jobradar.ai;


public interface AiProvider {

    /** Nom affiché et enregistré en base, ex. « groq/llama-3.3-70b-versatile » */
    String name();

    AiResponse complete(AiRequest request);
}