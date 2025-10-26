const { onRequest } = require("firebase-functions/https");
const admin = require('firebase-admin');
const { findSimilarDocuments } = require('./rag');
const { generateAnswerFromContext } = require('./llm');

/**
 * Generate AI-powered answers using RAG
 * HTTP endpoint for the React frontend
 */
exports.generateAnswer = onRequest({ cors: true }, async (req, res) => {
  try {
    // Validate request method
    if (req.method !== 'POST') {
      return res.status(405).json({
        success: false,
        error: 'Method not allowed. Use POST.'
      });
    }

    // Extract request data
    const {
      question,
      conversationId,
      previousMessages = [],
      linkUrl,
      filePath
    } = req.body;

    // Validate required fields
    if (!question || typeof question !== 'string' || question.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Question is required and must be a non-empty string.'
      });
    }

    console.log(`Processing question: "${question}"`);

    // Step 1: Find relevant documents using vector search
    console.log('Step 1: Searching for relevant documents...');
    const relevantDocs = await findSimilarDocuments(question, 5);
    console.log(`Found ${relevantDocs.length} relevant documents`);

    // Step 2: Handle link attachment (if provided)
    if (linkUrl) {
      console.log(`Processing attached link: ${linkUrl}`);
      // TODO: Implement link crawling in Phase 1
      // For now, add a note about the link
      relevantDocs.unshift({
        id: 'attached_link',
        content: `User provided link: ${linkUrl} (link processing will be implemented in Phase 1)`,
        url: linkUrl,
        lastUpdated: new Date().toISOString(),
        similarity: 1.0,
        metadata: {
          title: 'User Provided Link',
          section: 'Attachments',
          type: 'link'
        }
      });
    }

    // Step 3: Handle file attachment (if provided)
    if (filePath) {
      console.log(`Processing attached file: ${filePath}`);
      // TODO: Implement file processing in Phase 2
      // For now, add a note about the file
      relevantDocs.unshift({
        id: 'attached_file',
        content: `User uploaded file: ${filePath} (file processing will be implemented in Phase 2)`,
        url: 'file://uploaded',
        lastUpdated: new Date().toISOString(),
        similarity: 1.0,
        metadata: {
          title: 'User Uploaded File',
          section: 'Attachments',
          type: 'file'
        }
      });
    }

    // Step 4: Include conversation context if provided
    let contextualQuestion = question;
    if (previousMessages && previousMessages.length > 0) {
      const recentContext = previousMessages
        .slice(-3) // Last 3 exchanges
        .map(msg => `User: ${msg.question}\nAssistant: ${msg.answer}`)
        .join('\n\n');

      contextualQuestion = `Previous conversation context:\n${recentContext}\n\nCurrent question: ${question}`;
    }

    // Step 5: Generate answer using Gemini
    console.log('Step 5: Generating answer with Gemini...');
    const result = await generateAnswerFromContext(contextualQuestion, relevantDocs);

    // Step 6: Save to chat history (if conversationId provided)
    if (conversationId) {
      console.log(`Saving to conversation history: ${conversationId}`);
      const db = admin.firestore();

      const chatEntry = {
        conversationId: conversationId,
        question: question,
        answer: result.answer,
        confidence: result.confidence,
        sources: result.sources,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        tokenUsage: result.tokenUsage,
        attachments: {
          linkUrl: linkUrl || null,
          filePath: filePath || null
        }
      };

      await db.collection('chat_history').add(chatEntry);
      console.log('Chat history saved successfully');
    }

    // Step 7: Return response
    const response = {
      success: true,
      answer: result.answer,
      confidence: result.confidence,
      sources: result.sources,
      metadata: {
        conversationId: conversationId,
        relevantDocsCount: relevantDocs.length,
        hasLinkAttachment: !!linkUrl,
        hasFileAttachment: !!filePath,
        tokenUsage: result.tokenUsage,
        processedAt: new Date().toISOString()
      }
    };

    console.log(`Response generated successfully (confidence: ${result.confidence})`);
    res.json(response);

  } catch (error) {
    console.error('Error generating answer:', error);

    // Return user-friendly error
    const statusCode = error.code === 'permission-denied' ? 403 : 500;
    res.status(statusCode).json({
      success: false,
      error: 'Failed to generate answer. Please try again.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * Get chat history for a conversation
 */
exports.getHistory = onRequest({ cors: true }, async (req, res) => {
  try {
    if (req.method !== 'GET') {
      return res.status(405).json({
        success: false,
        error: 'Method not allowed. Use GET.'
      });
    }

    const { conversationId } = req.query;

    if (!conversationId) {
      return res.status(400).json({
        success: false,
        error: 'conversationId is required'
      });
    }

    const db = admin.firestore();
    const historyQuery = await db
      .collection('chat_history')
      .where('conversationId', '==', conversationId)
      .orderBy('timestamp', 'asc')
      .get();

    const history = [];
    historyQuery.forEach(doc => {
      const data = doc.data();
      history.push({
        id: doc.id,
        question: data.question,
        answer: data.answer,
        confidence: data.confidence,
        sources: data.sources,
        timestamp: data.timestamp?.toDate?.()?.toISOString?.() || data.timestamp,
        attachments: data.attachments
      });
    });

    res.json({
      success: true,
      conversationId: conversationId,
      history: history,
      messageCount: history.length
    });

  } catch (error) {
    console.error('Error fetching chat history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch chat history'
    });
  }
});