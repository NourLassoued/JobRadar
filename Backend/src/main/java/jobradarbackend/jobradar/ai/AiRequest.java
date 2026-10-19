package jobradarbackend.jobradar.ai;



public record AiRequest(String systemPrompt, String userPrompt, int maxTokens, double temperature, boolean jsonOutput) {}