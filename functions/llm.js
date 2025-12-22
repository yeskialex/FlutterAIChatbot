const {VertexAI} = require("@google-cloud/vertexai");

// Initialize Vertex AI
const vertexAi = new VertexAI({
  project: "hi-project-flutter-chatbot",
  location: "us-central1",
});

// Get the Gemini model
const model = vertexAi.getGenerativeModel({
  model: "gemini-2.5-flash",
  generation_config: {
    max_output_tokens: 2048,
    temperature: 0.1,
    top_p: 0.8,
    top_k: 40,
  },
});

/**
 * Generate answer from context using Gemini
 * @param {string} question - User's question
 * @param {Array} relevantDocs - Array of relevant documents from vector search
 * @param {Object} options - Additional options
 * @return {Promise<Object>} - Generated answer with metadata
 */
async function generateAnswerFromContext(question, relevantDocs, options = {}) {
  try {
    // Prepare context from relevant documents
    const context = relevantDocs.map((doc, index) =>
      `[Source ${index + 1}] ${doc.metadata?.title || "Flutter Documentation"}
URL: ${doc.url}
Content: ${doc.content}
Last Updated: ${doc.lastUpdated || "Unknown"}
---`,
    ).join("\n\n");

    // Construct the prompt
    const prompt = `You are a helpful Flutter development assistant. Answer the user's question based on the provided Flutter documentation context.

Guidelines:
- Provide accurate, practical answers based only on the context provided
- Include code examples when relevant
- Mention source URLs when referencing specific information
- If the context doesn't contain enough information, say so clearly
- Keep answers concise but comprehensive
- Use markdown formatting for code blocks

Context from Flutter Documentation:
${context}

User Question: ${question}

Answer:`;

    // Generate response from Gemini
    const result = await model.generateContent({
      contents: [{
        role: "user",
        parts: [{text: prompt}],
      }],
    });

    const response = result.response;
    const answer = response.candidates[0].content.parts[0].text;

    // Calculate confidence based on relevance scores
    const avgSimilarity = relevantDocs.length > 0 ?
      relevantDocs.reduce((sum, doc) => sum + (doc.similarity || 0), 0) / relevantDocs.length :
      0;

    // Confidence calculation
    let confidence = 0.5; // baseline
    if (relevantDocs.length >= 3) confidence += 0.2;
    confidence += (avgSimilarity - 0.5) * 0.4;
    if (answer.length > 200) confidence += 0.1;
    confidence = Math.min(Math.max(confidence, 0), 1);

    return {
      answer: answer,
      confidence: parseFloat(confidence.toFixed(2)),
      sources: relevantDocs.map((doc) => ({
        url: doc.url,
        title: doc.metadata?.title || "Flutter Documentation",
        lastUpdated: doc.lastUpdated,
        similarity: doc.similarity,
      })),
      tokenUsage: {
        promptTokens: prompt.length / 4, // rough estimate
        completionTokens: answer.length / 4, // rough estimate
        totalTokens: (prompt.length + answer.length) / 4,
      },
    };
  } catch (error) {
    console.error("Error generating answer:", error);
    throw error;
  }
}

/**
 * Generate conversation title using Gemini
 * @param {string} firstQuestion - First user question
 * @param {string} firstAnswer - First assistant answer
 * @return {Promise<string>} - Generated title (max 40 chars)
 */
async function generateConversationTitle(firstQuestion, firstAnswer) {
  try {
    const prompt = `Generate a short, descriptive title (maximum 40 characters) for this Flutter development conversation:

User: ${firstQuestion}
Assistant: ${firstAnswer.substring(0, 200)}...

Requirements:
- Maximum 40 characters
- Descriptive and specific to Flutter
- Focus on the main topic
- No quotes or punctuation at the end

Title:`;

    const result = await model.generateContent({
      contents: [{
        role: "user",
        parts: [{text: prompt}],
      }],
    });

    const title = result.response.candidates[0].content.parts[0].text.trim();

    // Ensure title is within character limit
    return title.length > 40 ? title.substring(0, 37) + "..." : title;
  } catch (error) {
    console.error("Error generating conversation title:", error);
    // Fallback title
    return "Flutter Development Chat";
  }
}

/**
 * Summarize long text using Gemini
 * @param {string} text - Text to summarize
 * @param {number} maxLength - Maximum length of summary
 * @return {Promise<string>} - Summarized text
 */
async function summarizeText(text, maxLength = 500) {
  try {
    const prompt = `Summarize the following Flutter documentation text in ${maxLength} characters or less. Keep technical details and code examples where important:

${text}

Summary:`;

    const result = await model.generateContent({
      contents: [{
        role: "user",
        parts: [{text: prompt}],
      }],
    });

    const summary = result.response.candidates[0].content.parts[0].text.trim();
    return summary.length > maxLength ? summary.substring(0, maxLength - 3) + "..." : summary;
  } catch (error) {
    console.error("Error summarizing text:", error);
    return text.substring(0, maxLength - 3) + "...";
  }
}

/**
 * Classify content type using Gemini
 * @param {string} content - Content to classify
 * @return {Promise<string>} - Content type (tutorial, api, guide, etc.)
 */
async function classifyContent(content) {
  const maxRetries = 3;
  let lastError = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const prompt = `Classify this Flutter documentation content into one of these categories:
- tutorial: Step-by-step instructions
- api: API reference documentation
- guide: Conceptual explanations
- cookbook: Code recipes/examples
- reference: Technical specifications

Content: ${content.substring(0, 500)}...

Category:`;

      const result = await model.generateContent({
        contents: [{
          role: "user",
          parts: [{text: prompt}],
        }],
      });

      const category = result.response.candidates[0].content.parts[0].text.trim().toLowerCase();

      // Validate category
      const validCategories = ["tutorial", "api", "guide", "cookbook", "reference"];
      return validCategories.includes(category) ? category : "guide";
    } catch (error) {
      lastError = error;
      console.error(`Error classifying content (attempt ${attempt}/${maxRetries}):`, error.message);

      if (attempt < maxRetries) {
        // Wait before retry (exponential backoff)
        const waitTime = Math.pow(2, attempt) * 1000;
        console.log(`Retrying in ${waitTime}ms...`);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }
  }

  console.error("Failed to classify content after all retries:", lastError);
  return "guide";
}

module.exports = {
  generateAnswerFromContext,
  generateConversationTitle,
  summarizeText,
  classifyContent,
};
