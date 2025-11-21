const {onRequest} = require("firebase-functions/https");
const admin = require("firebase-admin");

/**
 * Mock RAG API for frontend testing
 * Returns realistic responses without requiring vector search
 */
exports.mockRAG = onRequest({cors: true}, async (req, res) => {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({
        success: false,
        error: "Method not allowed. Use POST.",
      });
    }

    const {question, conversationId} = req.body;

    if (!question || typeof question !== "string") {
      return res.status(400).json({
        success: false,
        error: "Question is required and must be a string.",
      });
    }

    console.log(`Mock RAG processing: "${question}"`);

    // Mock relevant documents based on question keywords
    const mockDocs = getMockDocuments(question);

    // Generate mock answer based on question type
    const mockAnswer = generateMockAnswer(question, mockDocs);

    // Calculate mock confidence
    const confidence = calculateMockConfidence(question, mockDocs);

    // Mock sources
    const sources = mockDocs.map((doc) => ({
      url: doc.url,
      title: doc.title,
      lastUpdated: doc.lastUpdated,
      similarity: doc.similarity,
    }));

    // Save to chat history if conversationId provided
    if (conversationId) {
      const db = admin.firestore();
      await db.collection("chat_history").add({
        conversationId: conversationId,
        question: question,
        answer: mockAnswer,
        confidence: confidence,
        sources: sources,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        mockData: true,
      });
    }

    res.json({
      success: true,
      answer: mockAnswer,
      confidence: confidence,
      sources: sources,
      metadata: {
        conversationId: conversationId,
        relevantDocsCount: mockDocs.length,
        processedAt: new Date().toISOString(),
        mockResponse: true,
      },
    });
  } catch (error) {
    console.error("Mock RAG error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to generate answer",
    });
  }
});

/**
 * Get mock chat history
 */
exports.mockHistory = onRequest({cors: true}, async (req, res) => {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({
        success: false,
        error: "Method not allowed. Use GET.",
      });
    }

    const {conversationId} = req.query;

    if (!conversationId) {
      return res.status(400).json({
        success: false,
        error: "conversationId is required",
      });
    }

    const db = admin.firestore();
    const historyQuery = await db
        .collection("chat_history")
        .where("conversationId", "==", conversationId)
        .orderBy("timestamp", "asc")
        .get();

    const history = [];
    historyQuery.forEach((doc) => {
      const data = doc.data();
      history.push({
        id: doc.id,
        question: data.question,
        answer: data.answer,
        confidence: data.confidence,
        sources: data.sources,
        timestamp: data.timestamp?.toDate?.()?.toISOString?.() || data.timestamp,
        mockData: data.mockData || false,
      });
    });

    res.json({
      success: true,
      conversationId: conversationId,
      history: history,
      messageCount: history.length,
    });
  } catch (error) {
    console.error("Error fetching mock history:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch chat history",
    });
  }
});

/**
 * Generate mock documents based on question keywords
 */
function getMockDocuments(question) {
  const q = question.toLowerCase();

  if (q.includes("button") || q.includes("elevated") || q.includes("widget")) {
    return [
      {
        id: "flutter_buttons_guide",
        title: "Flutter Buttons and Widgets",
        content: "ElevatedButton is a Material Design button that displays with elevation. Use ElevatedButton for important, primary actions that require prominence.",
        url: "https://docs.flutter.dev/cookbook/forms/buttons",
        lastUpdated: "2024-01-15",
        similarity: 0.89,
      },
      {
        id: "flutter_material_design",
        title: "Material Design Components",
        content: "Flutter provides a comprehensive set of Material Design widgets including buttons, cards, and navigation elements.",
        url: "https://docs.flutter.dev/ui/widgets/material",
        lastUpdated: "2024-01-10",
        similarity: 0.76,
      },
    ];
  }

  if (q.includes("state") || q.includes("stateful") || q.includes("setstate")) {
    return [
      {
        id: "flutter_state_management",
        title: "State Management in Flutter",
        content: "StatefulWidget allows you to create dynamic UI that can change over time. Use setState() to update the widget state.",
        url: "https://docs.flutter.dev/development/ui/interactive",
        lastUpdated: "2024-01-20",
        similarity: 0.92,
      },
      {
        id: "flutter_lifecycle",
        title: "Widget Lifecycle",
        content: "Understanding the Flutter widget lifecycle is crucial for proper state management and performance optimization.",
        url: "https://docs.flutter.dev/development/ui/widgets-intro",
        lastUpdated: "2024-01-18",
        similarity: 0.81,
      },
    ];
  }

  if (q.includes("navigation") || q.includes("route") || q.includes("page")) {
    return [
      {
        id: "flutter_navigation",
        title: "Navigation and Routing",
        content: "Navigate between screens using Navigator.push() and Navigator.pop(). For complex navigation, consider using named routes.",
        url: "https://docs.flutter.dev/cookbook/navigation/navigation-basics",
        lastUpdated: "2024-01-12",
        similarity: 0.87,
      },
      {
        id: "flutter_routes",
        title: "Route Management",
        content: "Define routes in your MaterialApp and use Navigator.pushNamed() for navigation between different screens.",
        url: "https://docs.flutter.dev/cookbook/navigation/named-routes",
        lastUpdated: "2024-01-08",
        similarity: 0.79,
      },
    ];
  }

  // Default documents for general questions
  return [
    {
      id: "flutter_getting_started",
      title: "Getting Started with Flutter",
      content: "Flutter is Google's UI toolkit for building beautiful, natively compiled applications for mobile, web, and desktop.",
      url: "https://docs.flutter.dev/get-started",
      lastUpdated: "2024-01-25",
      similarity: 0.65,
    },
    {
      id: "flutter_widgets_intro",
      title: "Introduction to Widgets",
      content: "Everything in Flutter is a widget. Widgets describe what their view should look like given their current configuration and state.",
      url: "https://docs.flutter.dev/development/ui/widgets-intro",
      lastUpdated: "2024-01-22",
      similarity: 0.58,
    },
  ];
}

/**
 * Generate mock answer based on question and documents
 */
function generateMockAnswer(question, docs) {
  const q = question.toLowerCase();

  if (q.includes("button")) {
    return `To create buttons in Flutter, you can use several widget options:

## ElevatedButton
The most common button for primary actions:
\`\`\`dart
ElevatedButton(
  onPressed: () {
    print('Button pressed!');
  },
  child: Text('Click Me'),
)
\`\`\`

## TextButton
For secondary actions or less prominent buttons:
\`\`\`dart
TextButton(
  onPressed: () => print('Text button pressed'),
  child: Text('Text Button'),
)
\`\`\`

ElevatedButton provides visual elevation and is recommended for important actions, while TextButton is better for secondary actions.

**Sources**: Based on Flutter's official button documentation and Material Design guidelines.`;
  }

  if (q.includes("state")) {
    return `State management in Flutter involves using StatefulWidget and setState():

## Basic State Management
\`\`\`dart
class MyWidget extends StatefulWidget {
  @override
  _MyWidgetState createState() => _MyWidgetState();
}

class _MyWidgetState extends State<MyWidget> {
  int counter = 0;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text('Counter: $counter'),
        ElevatedButton(
          onPressed: () {
            setState(() {
              counter++;
            });
          },
          child: Text('Increment'),
        ),
      ],
    );
  }
}
\`\`\`

The \`setState()\` method tells Flutter to rebuild the widget with updated state.

**Key Points:**
- Use StatefulWidget when your UI needs to change
- Call setState() to trigger rebuilds
- Keep state changes within setState() callback

**Sources**: Flutter official documentation on state management and widget lifecycle.`;
  }

  if (q.includes("navigation")) {
    return `Navigation in Flutter is handled using the Navigator class:

## Basic Navigation
\`\`\`dart
// Navigate to new screen
Navigator.push(
  context,
  MaterialPageRoute(builder: (context) => SecondScreen()),
);

// Go back
Navigator.pop(context);
\`\`\`

## Named Routes
Define routes in your MaterialApp:
\`\`\`dart
MaterialApp(
  routes: {
    '/': (context) => HomeScreen(),
    '/second': (context) => SecondScreen(),
  },
)

// Navigate using named routes
Navigator.pushNamed(context, '/second');
\`\`\`

**Best Practices:**
- Use MaterialPageRoute for automatic platform transitions
- Consider named routes for complex navigation
- Always provide a way to go back

**Sources**: Flutter navigation cookbook and routing documentation.`;
  }

  // Default answer
  return `Based on your question about "${question}", here are some key points from the Flutter documentation:

Flutter is a comprehensive UI toolkit that provides widgets for building beautiful applications. The framework follows a reactive programming model where widgets describe what the UI should look like given the current state.

## Key Concepts:
- Everything in Flutter is a widget
- Widgets are immutable and describe the UI configuration
- Use StatefulWidget when you need to manage changing state
- StatelessWidget is for static content

## Getting Started:
1. Install Flutter SDK
2. Set up your development environment
3. Create a new Flutter project
4. Start building with widgets

For specific implementation details, I recommend checking the official Flutter documentation which provides comprehensive guides and examples.

**Sources**: Based on Flutter's getting started guide and widget introduction documentation.`;
}

/**
 * Calculate mock confidence based on question specificity
 */
function calculateMockConfidence(question, docs) {
  let confidence = 0.6; // base confidence

  // Higher confidence for specific questions
  const specificKeywords = ["button", "state", "navigation", "widget", "flutter"];
  const foundKeywords = specificKeywords.filter((keyword) =>
    question.toLowerCase().includes(keyword),
  );

  confidence += foundKeywords.length * 0.1;
  confidence += docs.length > 0 ? 0.2 : 0;

  return Math.min(confidence, 0.95); // cap at 95%
}
