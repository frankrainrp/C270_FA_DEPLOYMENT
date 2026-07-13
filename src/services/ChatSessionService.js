const ChatSession = require("../models/ChatSession");
const MAX_SESSION_MESSAGES = 100;

class ChatSessionService {
  /**
   * Create a new chat session, owned by ownerEmail.
   */
  async create(ownerEmail) {
    const session = new ChatSession({ messages: [], ownerEmail });
    return await session.save();
  }

  /**
   * Get the latest active chat session for ownerEmail, or create a new
   * one if none exists yet.
   */
  async getLatestSession(ownerEmail) {
    let session = await ChatSession.findOne({ active: true, ownerEmail }).sort({ updatedAt: -1 });

    if (!session) {
      session = await this.create(ownerEmail);
    }

    return session;
  }

  /**
   * Get a chat session by ID, scoped to ownerEmail. Returns null both
   * when the id doesn't exist and when it belongs to someone else, so
   * callers can't tell the two cases apart from the response.
   */
  async findById(sessionId, ownerEmail) {
    return await ChatSession.findOne({ _id: sessionId, ownerEmail });
  }

  /**
   * Add a message to a session, scoped to ownerEmail.
   */
  async addMessage(sessionId, role, content, ownerEmail, attachments) {
    const session = await ChatSession.findOne({ _id: sessionId, ownerEmail });
    if (!session) {
      throw new Error("Session not found");
    }

    session.messages.push({
      role,
      content,
      attachments: Array.isArray(attachments) && attachments.length ? attachments : undefined,
      timestamp: new Date(),
    });
    if (session.messages.length > MAX_SESSION_MESSAGES) {
      session.messages = session.messages.slice(-MAX_SESSION_MESSAGES);
    }

    return await session.save();
  }

  /**
   * Get all messages in a session, scoped to ownerEmail.
   */
  async getMessages(sessionId, ownerEmail) {
    const session = await ChatSession.findOne({ _id: sessionId, ownerEmail });
    if (!session) {
      throw new Error("Session not found");
    }

    return session.messages;
  }

  /**
   * Clear all messages in a session (but keep the session), scoped to
   * ownerEmail.
   */
  async clearMessages(sessionId, ownerEmail) {
    const session = await ChatSession.findOne({ _id: sessionId, ownerEmail });
    if (!session) {
      throw new Error("Session not found");
    }

    session.messages = [];
    return await session.save();
  }

  /**
   * Close/deactivate a session, scoped to ownerEmail.
   */
  async closeSession(sessionId, ownerEmail) {
    return await ChatSession.findOneAndUpdate(
      { _id: sessionId, ownerEmail },
      { active: false },
      { new: true }
    );
  }

  /**
   * Get all chat sessions for ownerEmail (for history/archive sidebar).
   */
  async findAll(ownerEmail) {
    return await ChatSession.find({ ownerEmail }).sort({ updatedAt: -1 });
  }

  /**
   * Delete a session, scoped to ownerEmail.
   */
  async delete(sessionId, ownerEmail) {
    return await ChatSession.findOneAndDelete({ _id: sessionId, ownerEmail });
  }
}

module.exports = new ChatSessionService();
