const sseService = require('../services/sseService');

class SSEController {
  /**
   * GET /api/stream
   * Initiates Server-Sent Events stream for authenticated client.
   */
  stream(req, res) {
    return sseService.handleStreamConnection(req, res);
  }
}

module.exports = new SSEController();
