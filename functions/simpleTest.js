const { onRequest } = require("firebase-functions/https");

/**
 * Minimal test function to verify deployment works
 */
exports.simpleTest = onRequest({ cors: true }, async (req, res) => {
  try {
    console.log('Simple test function called');

    res.json({
      success: true,
      message: 'Simple test function working',
      timestamp: new Date().toISOString(),
      method: req.method
    });

  } catch (error) {
    console.error('Simple test error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});