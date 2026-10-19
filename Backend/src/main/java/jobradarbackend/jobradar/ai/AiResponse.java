package jobradarbackend.jobradar.ai;

public record AiResponse(String content, String model, int inputTokens, int outputTokens) {}