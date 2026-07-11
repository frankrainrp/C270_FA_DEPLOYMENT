const ChatSession = require("../models/ChatSession");

class ChatSessionService {
  /**
   * Create a new chat session
   */
  async create() {
    const session = new ChatSession({ messages: [] });
    return await session.save();
  }

  /**
   * Get the latest active chat session, or create a new one if none exists
   */
  async getLatestSession() {
    let session = await ChatSession.findOne({ active: true }).sort({ updatedAt: -1 });

    if (!session) {
      session = await this.create();
    }

    return session;
  }

  /**
   * Get a chat session by ID
   */
  async findById(sessionId) {
    return await ChatSession.findById(sessionId);
  }

  /**
   * Add a message to a session
   */
  async addMessage(sessionId, role, content, attachments) {
    const session = await ChatSession.findById(sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    session.messages.push({
      role,
      content,
      attachments: Array.isArray(attachments) && attachments.length ? attachments : undefined,
      timestamp: new Date(),
    });

    return await session.save();
  }

  /**
   * Get all messages in a session
   */
  async getMessages(sessionId) {
    const session = await ChatSession.findById(sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    return session.messages;
  }

  /**
   * Clear all messages in a session (but keep the session)
   */
  async clearMessages(sessionId) {
    const session = await ChatSession.findById(sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    session.messages = [];
    return await session.save();
  }

  /**
   * Close/deactivate a session
   */
  async closeSession(sessionId) {
    return await ChatSession.findByIdAndUpdate(
      sessionId,
      { active: false },
      { new: true }
    );
  }

  /**
   * Get all chat sessions (for history/archive)
   */
  async findAll() {
    return await ChatSession.find().sort({ updatedAt: -1 });
  }

  /**
   * Delete a session
   */
  async delete(sessionId) {
    return await ChatSession.findByIdAndDelete(sessionId);
  }
}

module.exports = new ChatSessionService();
