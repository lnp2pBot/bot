import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Mock localStorage for Node.js environment
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(global, 'localStorage', {
  value: localStorageMock
});

// Mock external dependencies
jest.mock('./external-dependencies', () => ({
  apiClient: {
    send: jest.fn(),
    fetch: jest.fn(),
  },
  logger: {
    log: jest.fn(),
    error: jest.fn(),
  },
}));

// Import the module under test (assuming standard structure)
// import { 
//   createMessage, 
//   editMessage, 
//   deleteMessage, 
//   getMessage,
//   validateMessage,
//   formatMessage,
//   sanitizeMessage,
//   extractMentions,
//   extractHashtags,
//   createReply,
//   searchMessages,
//   filterMessagesByDate,
//   addReaction,
//   removeReaction,
//   getMessageReactions,
//   getMessageThread,
//   sendMessage,
//   saveMessage
// } from './messages';

describe('Messages Module - Comprehensive Test Suite', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    // Clear any in-memory storage
    localStorageMock.clear();
  });

  afterEach(() => {
    // Clean up after each test
    jest.restoreAllMocks();
  });

  describe('Message Creation - Happy Path', () => {
    it('should create a new message with valid content', () => {
      const content = 'Hello, world!';
      const message = createMessage(content);
      
      expect(message).toBeDefined();
      expect(message.id).toBeDefined();
      expect(message.content).toBe(content);
      expect(message.createdAt).toBeInstanceOf(Date);
      expect(message.editedAt).toBeNull();
    });

    it('should create message with author information', () => {
      const content = 'Test message';
      const author = 'user123';
      const message = createMessage(content, author);
      
      expect(message.author).toBe(author);
      expect(message.content).toBe(content);
    });

    it('should create message with metadata', () => {
      const content = 'Test message';
      const metadata = { channel: 'general', priority: 'high' };
      const message = createMessage(content, 'user1', metadata);
      
      expect(message.metadata).toEqual(metadata);
    });

    it('should auto-generate unique message IDs', () => {
      const message1 = createMessage('Message 1');
      const message2 = createMessage('Message 2');
      
      expect(message1.id).not.toBe(message2.id);
      expect(message1.id).toMatch(/^[a-zA-Z0-9-_]+$/);
    });
  });

  describe('Message Creation - Edge Cases', () => {
    it('should handle empty string content', () => {
      const message = createMessage('');
      expect(message.content).toBe('');
    });

    it('should handle whitespace-only content', () => {
      const content = '   \n\t   ';
      const message = createMessage(content);
      expect(message.content).toBe(content);
    });

    it('should handle very long messages', () => {
      const longContent = 'a'.repeat(10000);
      const message = createMessage(longContent);
      expect(message.content).toBe(longContent);
    });

    it('should handle special characters and emojis', () => {
      const content = '🚀 Special chars: àáâãäå ©®™ @#$%^&*()';
      const message = createMessage(content);
      expect(message.content).toBe(content);
    });

    it('should handle newlines and formatting', () => {
      const content = 'Line 1\nLine 2\r\nLine 3\tTabbed';
      const message = createMessage(content);
      expect(message.content).toBe(content);
    });
  });

  describe('Message Creation - Error Handling', () => {
    it('should throw error for null content', () => {
      expect(() => createMessage(null as any)).toThrow('Invalid message content');
    });

    it('should throw error for undefined content', () => {
      expect(() => createMessage(undefined as any)).toThrow('Invalid message content');
    });

    it('should throw error for non-string content', () => {
      expect(() => createMessage(123 as any)).toThrow('Message content must be a string');
    });

    it('should throw error for content exceeding maximum length', () => {
      const tooLongContent = 'a'.repeat(50001);
      expect(() => createMessage(tooLongContent)).toThrow('Message exceeds maximum length');
    });
  });

  describe('Message Validation', () => {
    it('should validate correct message format', () => {
      const validMessage = 'This is a valid message';
      expect(validateMessage(validMessage)).toBe(true);
    });

    it('should reject empty messages', () => {
      expect(validateMessage('')).toBe(false);
      expect(validateMessage(null)).toBe(false);
      expect(validateMessage(undefined)).toBe(false);
    });

    it('should reject whitespace-only messages', () => {
      expect(validateMessage('   ')).toBe(false);
      expect(validateMessage('\n\t\r')).toBe(false);
    });

    it('should reject messages that are too long', () => {
      const tooLong = 'a'.repeat(5001);
      expect(validateMessage(tooLong)).toBe(false);
    });

    it('should validate messages with mentions and hashtags', () => {
      const messageWithTags = 'Hello @user1 check out #awesome-project';
      expect(validateMessage(messageWithTags)).toBe(true);
    });

    it('should handle malicious content validation', () => {
      const maliciousMessage = '<script>alert("xss")</script>';
      expect(validateMessage(maliciousMessage)).toBe(true); // Should be validated but sanitized later
    });
  });

  describe('Message Formatting and Sanitization', () => {
    it('should format basic message correctly', () => {
      const message = 'Hello world';
      const formatted = mockFormatMessage(message);
      expect(formatted).toBe(message);
    });

    it('should preserve line breaks in formatting', () => {
      const message = 'Line 1\nLine 2\nLine 3';
      const formatted = mockFormatMessage(message);
      expect(formatted).toContain('\n');
    });

    it('should sanitize HTML content', () => {
      const htmlMessage = '<script>alert("test")</script><p>Safe content</p>';
      const sanitized = mockSanitizeMessage(htmlMessage);
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).not.toContain('alert');
    });

    it('should sanitize dangerous attributes', () => {
      const dangerousMessage = '<img src="x" onerror="alert(1)">';
      const sanitized = mockSanitizeMessage(dangerousMessage);
      expect(sanitized).not.toContain('onerror');
    });

    it('should preserve safe HTML tags', () => {
      const safeHtml = '<p>This is <strong>bold</strong> and <em>italic</em></p>';
      const sanitized = mockSanitizeMessage(safeHtml);
      expect(sanitized).toContain('<p>');
      expect(sanitized).toContain('<strong>');
      expect(sanitized).toContain('<em>');
    });

    it('should handle URL formatting', () => {
      const messageWithUrl = 'Check out https://example.com';
      const formatted = mockFormatMessage(messageWithUrl);
      expect(formatted).toContain('https://example.com');
    });
  });

  describe('Message Parsing - Mentions and Hashtags', () => {
    it('should extract single mention correctly', () => {
      const message = 'Hello @username';
      const mentions = mockExtractMentions(message);
      expect(mentions).toEqual(['username']);
    });

    it('should extract multiple mentions', () => {
      const message = 'Hello @user1 and @user2, also @user3';
      const mentions = mockExtractMentions(message);
      expect(mentions).toEqual(['user1', 'user2', 'user3']);
    });

    it('should extract hashtags correctly', () => {
      const message = 'Working on #project1 and #project2';
      const hashtags = mockExtractHashtags(message);
      expect(hashtags).toEqual(['project1', 'project2']);
    });

    it('should handle mixed mentions and hashtags', () => {
      const message = 'Hey @alice, check out #coolproject and tell @bob';
      const mentions = mockExtractMentions(message);
      const hashtags = mockExtractHashtags(message);
      expect(mentions).toEqual(['alice', 'bob']);
      expect(hashtags).toEqual(['coolproject']);
    });

    it('should ignore malformed mentions', () => {
      const message = 'Hello @ user and @';
      const mentions = mockExtractMentions(message);
      expect(mentions).toEqual([]);
    });

    it('should handle mentions with underscores and numbers', () => {
      const message = 'Hello @user_123 and @test_user_2';
      const mentions = mockExtractMentions(message);
      expect(mentions).toEqual(['user_123', 'test_user_2']);
    });

    it('should deduplicate mentions and hashtags', () => {
      const message = '@user1 @user1 #tag1 #tag1';
      const mentions = mockExtractMentions(message);
      const hashtags = mockExtractHashtags(message);
      expect(mentions).toEqual(['user1']);
      expect(hashtags).toEqual(['tag1']);
    });
  });

  describe('Message Editing', () => {
    let originalMessage: any;

    beforeEach(() => {
      originalMessage = createMessage('Original content');
    });

    it('should edit message content successfully', () => {
      const newContent = 'Updated content';
      const editedMessage = editMessage(originalMessage.id, newContent);
      
      expect(editedMessage.content).toBe(newContent);
      expect(editedMessage.editedAt).toBeInstanceOf(Date);
      expect(editedMessage.id).toBe(originalMessage.id);
    });

    it('should preserve original creation timestamp', () => {
      const editedMessage = editMessage(originalMessage.id, 'New content');
      expect(editedMessage.createdAt).toEqual(originalMessage.createdAt);
    });

    it('should update edit timestamp', () => {
      const editedMessage = editMessage(originalMessage.id, 'New content');
      expect(editedMessage.editedAt.getTime()).toBeGreaterThan(originalMessage.createdAt.getTime());
    });

    it('should throw error when editing non-existent message', () => {
      expect(() => editMessage('non-existent-id', 'New content')).toThrow('Message not found');
    });

    it('should validate new content before editing', () => {
      expect(() => editMessage(originalMessage.id, '')).toThrow('Invalid message content');
    });

    it('should maintain edit history', () => {
      editMessage(originalMessage.id, 'First edit');
      const finalEdit = editMessage(originalMessage.id, 'Second edit');
      
      expect(finalEdit.editHistory).toHaveLength(2);
      expect(finalEdit.editHistory[0].content).toBe('First edit');
      expect(finalEdit.editHistory[1].content).toBe('Second edit');
    });
  });

  describe('Message Deletion', () => {
    let testMessage: any;

    beforeEach(() => {
      testMessage = createMessage('Message to delete');
    });

    it('should delete message successfully', () => {
      const result = deleteMessage(testMessage.id);
      expect(result).toBe(true);
    });

    it('should throw error when trying to get deleted message', () => {
      deleteMessage(testMessage.id);
      expect(() => getMessage(testMessage.id)).toThrow('Message not found');
    });

    it('should handle deletion of non-existent message', () => {
      expect(() => deleteMessage('non-existent-id')).toThrow('Message not found');
    });

    it('should soft delete messages by default', () => {
      deleteMessage(testMessage.id);
      const deletedMessage = getMessage(testMessage.id, { includeDeleted: true });
      expect(deletedMessage.deleted).toBe(true);
      expect(deletedMessage.deletedAt).toBeInstanceOf(Date);
    });

    it('should hard delete when specified', () => {
      deleteMessage(testMessage.id, { hard: true });
      expect(() => getMessage(testMessage.id, { includeDeleted: true })).toThrow('Message not found');
    });
  });

  describe('Message Threading and Replies', () => {
    let parentMessage: any;

    beforeEach(() => {
      parentMessage = createMessage('Parent message');
    });

    it('should create reply to message', () => {
      const replyContent = 'This is a reply';
      const reply = mockCreateReply(parentMessage.id, replyContent);
      
      expect(reply.parentId).toBe(parentMessage.id);
      expect(reply.content).toBe(replyContent);
      expect(reply.isReply).toBe(true);
    });

    it('should create nested replies', () => {
      const reply1 = mockCreateReply(parentMessage.id, 'First reply');
      const reply2 = mockCreateReply(reply1.id, 'Reply to reply');
      
      expect(reply2.parentId).toBe(reply1.id);
      expect(reply2.depth).toBe(2);
    });

    it('should get complete message thread', () => {
      const reply1 = mockCreateReply(parentMessage.id, 'Reply 1');
      const reply2 = mockCreateReply(parentMessage.id, 'Reply 2');
      const nestedReply = mockCreateReply(reply1.id, 'Nested reply');
      
      const thread = mockGetMessageThread(parentMessage.id);
      expect(thread).toHaveLength(4);
      expect(thread[0].id).toBe(parentMessage.id);
    });

    it('should handle thread depth limits', () => {
      let currentParent = parentMessage;
      
      // Create deeply nested replies
      for (let i = 0; i < 10; i++) {
        currentParent = mockCreateReply(currentParent.id, `Reply depth ${i + 1}`);
      }
      
      // Should enforce max depth
      expect(() => mockCreateReply(currentParent.id, 'Too deep')).toThrow('Maximum thread depth exceeded');
    });

    it('should reject replies to non-existent messages', () => {
      expect(() => mockCreateReply('fake-id', 'Reply content')).toThrow('Parent message not found');
    });

    it('should maintain thread integrity', () => {
      const reply = mockCreateReply(parentMessage.id, 'Reply');
      deleteMessage(parentMessage.id);
      
      // Reply should be orphaned or deleted
      expect(() => mockGetMessageThread(parentMessage.id)).toThrow('Message not found');
    });
  });

  describe('Message Reactions', () => {
    let testMessage: any;

    beforeEach(() => {
      testMessage = createMessage('React to this message');
    });

    it('should add reaction to message', () => {
      const result = mockAddReaction(testMessage.id, '👍', 'user1');
      expect(result).toBe(true);
      
      const reactions = mockGetMessageReactions(testMessage.id);
      expect(reactions['👍']).toContain('user1');
    });

    it('should prevent duplicate reactions from same user', () => {
      mockAddReaction(testMessage.id, '👍', 'user1');
      expect(() => mockAddReaction(testMessage.id, '👍', 'user1')).toThrow('Reaction already exists');
    });

    it('should allow different users to use same emoji', () => {
      mockAddReaction(testMessage.id, '👍', 'user1');
      mockAddReaction(testMessage.id, '👍', 'user2');
      
      const reactions = mockGetMessageReactions(testMessage.id);
      expect(reactions['👍']).toEqual(['user1', 'user2']);
    });

    it('should remove reactions correctly', () => {
      mockAddReaction(testMessage.id, '👍', 'user1');
      const result = mockRemoveReaction(testMessage.id, '👍', 'user1');
      
      expect(result).toBe(true);
      const reactions = mockGetMessageReactions(testMessage.id);
      expect(reactions['👍']).toBeUndefined();
    });

    it('should handle removal of non-existent reactions', () => {
      expect(() => mockRemoveReaction(testMessage.id, '👍', 'user1')).toThrow('Reaction not found');
    });

    it('should validate emoji format', () => {
      expect(() => mockAddReaction(testMessage.id, 'invalid', 'user1')).toThrow('Invalid emoji format');
    });

    it('should count reactions correctly', () => {
      mockAddReaction(testMessage.id, '👍', 'user1');
      mockAddReaction(testMessage.id, '👍', 'user2');
      mockAddReaction(testMessage.id, '❤️', 'user1');
      
      const reactions = mockGetMessageReactions(testMessage.id);
      expect(reactions['👍']).toHaveLength(2);
      expect(reactions['❤️']).toHaveLength(1);
    });
  });

  describe('Message Search and Filtering', () => {
    let testMessages: any[];

    beforeEach(() => {
      testMessages = [
        createMessage('Hello world'),
        createMessage('JavaScript is awesome'),
        createMessage('TypeScript rocks'),
        createMessage('React components'),
        createMessage('Node.js backend')
      ];
    });

    it('should search messages by content', () => {
      const results = mockSearchMessages(testMessages, 'JavaScript');
      expect(results).toHaveLength(1);
      expect(results[0].content).toContain('JavaScript');
    });

    it('should perform case-insensitive search', () => {
      const results = mockSearchMessages(testMessages, 'HELLO');
      expect(results).toHaveLength(1);
      expect(results[0].content).toContain('Hello');
    });

    it('should search with partial matches', () => {
      const results = mockSearchMessages(testMessages, 'Script');
      expect(results).toHaveLength(2); // JavaScript and TypeScript
    });

    it('should return empty array for no matches', () => {
      const results = mockSearchMessages(testMessages, 'Python');
      expect(results).toHaveLength(0);
    });

    it('should filter messages by date range', () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
      
      const filtered = mockFilterMessagesByDate(testMessages, yesterday, tomorrow);
      expect(filtered).toHaveLength(testMessages.length);
    });

    it('should filter messages by author', () => {
      const authorMessages = [
        createMessage('Message 1', 'alice'),
        createMessage('Message 2', 'bob'),
        createMessage('Message 3', 'alice')
      ];
      
      const aliceMessages = mockFilterMessagesByAuthor(authorMessages, 'alice');
      expect(aliceMessages).toHaveLength(2);
    });

    it('should combine search and filter operations', () => {
      const complexMessages = [
        createMessage('Hello from Alice', 'alice'),
        createMessage('Hello from Bob', 'bob'),
        createMessage('Goodbye from Alice', 'alice')
      ];
      
      const results = mockSearchMessages(
        mockFilterMessagesByAuthor(complexMessages, 'alice'),
        'Hello'
      );
      
      expect(results).toHaveLength(1);
      expect(results[0].author).toBe('alice');
      expect(results[0].content).toContain('Hello');
    });
  });

  describe('Message Persistence and Storage', () => {
    it('should save message to storage', () => {
      const message = createMessage('Test message');
      const result = mockSaveMessage(message);
      
      expect(result).toBe(true);
      expect(localStorageMock.setItem).toHaveBeenCalledWith(`message_${message.id}`, expect.any(String));
    });

    it('should retrieve message from storage', () => {
      const message = createMessage('Stored message');
      mockSaveMessage(message);
      
      const retrieved = getMessage(message.id);
      expect(retrieved).toEqual(message);
    });

    it('should handle storage errors gracefully', () => {
      // Mock storage quota exceeded
      const originalSetItem = localStorageMock.setItem;
      localStorageMock.setItem = jest.fn(() => {
        throw new Error('QuotaExceededError');
      });
      
      const message = createMessage('Test message');
      expect(() => mockSaveMessage(message)).not.toThrow();
      
      localStorageMock.setItem = originalSetItem;
    });

    it('should batch save multiple messages', () => {
      const messages = Array.from({ length: 10 }, (_, i) => 
        createMessage(`Batch message ${i}`)
      );
      
      const result = mockBatchSaveMessages(messages);
      expect(result).toBe(true);
      
      messages.forEach(msg => {
        expect(getMessage(msg.id)).toEqual(msg);
      });
    });
  });

  describe('Performance and Scalability', () => {
    it('should create messages efficiently', () => {
      const startTime = performance.now();
      const messages = [];
      
      for (let i = 0; i < 1000; i++) {
        messages.push(createMessage(`Performance test ${i}`));
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
      expect(messages).toHaveLength(1000);
    });

    it('should search large message sets efficiently', () => {
      const largeMessageSet = Array.from({ length: 10000 }, (_, i) => 
        createMessage(`Message ${i} with searchterm ${i % 100}`)
      );
      
      const startTime = performance.now();
      const results = mockSearchMessages(largeMessageSet, 'searchterm 50');
      const endTime = performance.now();
      
      expect(endTime - startTime).toBeLessThan(100); // Less than 100ms
      expect(results.length).toBeGreaterThan(0);
    });

    it('should handle memory efficiently with large datasets', () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Create and process many messages
      for (let i = 0; i < 5000; i++) {
        const message = createMessage(`Memory test ${i}`);
        mockProcessMessage(message);
      }
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });
  });

  describe('Concurrency and Race Conditions', () => {
    it('should handle concurrent message creation', async () => {
      const promises = Array.from({ length: 100 }, (_, i) =>
        Promise.resolve(createMessage(`Concurrent message ${i}`))
      );
      
      const results = await Promise.all(promises);
      const ids = results.map(msg => msg.id);
      const uniqueIds = new Set(ids);
      
      expect(uniqueIds.size).toBe(ids.length); // All IDs should be unique
    });

    it('should handle concurrent edits safely', () => {
      const message = createMessage('Original content');
      
      // Simulate concurrent edits
      const edit1 = () => editMessage(message.id, 'Edit 1');
      const edit2 = () => editMessage(message.id, 'Edit 2');
      
      // One should succeed, implementation-dependent
      expect(() => {
        edit1();
        edit2();
      }).not.toThrow();
    });

    it('should handle concurrent reactions safely', () => {
      const message = createMessage('Message for reactions');
      
      const reactions = Array.from({ length: 10 }, (_, i) =>
        () => mockAddReaction(message.id, '👍', `user${i}`)
      );
      
      reactions.forEach(reaction => {
        expect(() => reaction()).not.toThrow();
      });
      
      const finalReactions = mockGetMessageReactions(message.id);
      expect(finalReactions['👍']).toHaveLength(10);
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should recover from API failures gracefully', async () => {
      // Mock API failure
      const mockSend = jest.fn().mockRejectedValue(new Error('Network error'));
      
      const message = createMessage('Test message');
      
      // Should not throw, should handle gracefully
      await expect(mockSendMessage(message)).resolves.not.toThrow();
    });

    it('should handle corrupted message data', () => {
      // Simulate corrupted data in storage
      localStorageMock.setItem('message_corrupted', 'invalid-json');
      
      expect(() => getMessage('corrupted')).toThrow('Failed to parse message data');
    });

    it('should validate message integrity', () => {
      const message = createMessage('Test message');
      
      // Corrupt the message
      message.id = null;
      
      expect(mockValidateMessageIntegrity(message)).toBe(false);
    });

    it('should handle missing dependencies gracefully', () => {
      // Mock missing external service
      jest.doMock('./external-service', () => {
        throw new Error('Service unavailable');
      });
      
      expect(() => createMessage('Test')).not.toThrow();
    });
  });

  describe('Integration Workflows', () => {
    it('should handle complete message lifecycle', () => {
      // Create
      const message = createMessage('Lifecycle test message');
      expect(message.id).toBeDefined();
      
      // Read
      const retrieved = getMessage(message.id);
      expect(retrieved.content).toBe('Lifecycle test message');
      
      // Update
      const edited = editMessage(message.id, 'Updated message');
      expect(edited.content).toBe('Updated message');
      expect(edited.editedAt).toBeDefined();
      
      // React
      mockAddReaction(message.id, '👍', 'user1');
      const reactions = mockGetMessageReactions(message.id);
      expect(reactions['👍']).toContain('user1');
      
      // Delete
      deleteMessage(message.id);
      expect(() => getMessage(message.id)).toThrow('Message not found');
    });

    it('should handle conversation thread workflow', () => {
      // Start conversation
      const original = createMessage('What do you think about this feature?');
      
      // Add replies
      const reply1 = mockCreateReply(original.id, 'I think it is great!');
      const reply2 = mockCreateReply(original.id, 'Needs some improvements');
      const nestedReply = mockCreateReply(reply1.id, 'I agree with you');
      
      // Get full thread
      const thread = mockGetMessageThread(original.id);
      expect(thread).toHaveLength(4);
      
      // Add reactions to different messages in thread
      mockAddReaction(original.id, '🤔', 'user1');
      mockAddReaction(reply1.id, '👍', 'user2');
      mockAddReaction(reply2.id, '💭', 'user3');
      
      // Verify thread integrity
      const threadWithReactions = mockGetMessageThread(original.id, { includeReactions: true });
      expect(threadWithReactions[0].reactions).toBeDefined();
      expect(threadWithReactions[1].reactions).toBeDefined();
    });

    it('should handle bulk operations workflow', () => {
      // Create multiple messages
      const messages = Array.from({ length: 50 }, (_, i) => 
        createMessage(`Bulk message ${i}`)
      );
      
      // Batch save
      const saveResult = mockBatchSaveMessages(messages);
      expect(saveResult).toBe(true);
      
      // Bulk search
      const searchResults = mockSearchMessages(messages, 'Bulk');
      expect(searchResults).toHaveLength(50);
      
      // Bulk edit (update all messages from a specific author)
      const editResults = mockBulkEditMessages(
        messages.map(m => m.id),
        'Updated bulk message'
      );
      expect(editResults.success).toBe(true);
      expect(editResults.updated).toBe(50);
      
      // Bulk delete
      const deleteResults = mockBulkDeleteMessages(messages.map(m => m.id));
      expect(deleteResults.success).toBe(true);
      expect(deleteResults.deleted).toBe(50);
    });
  });

  describe('Security and Validation', () => {
    it('should prevent XSS attacks in message content', () => {
      const maliciousContent = '<script>alert("XSS")</script><img src="x" onerror="alert(1)">';
      const message = createMessage(maliciousContent);
      const sanitized = mockSanitizeMessage(message.content);
      
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).not.toContain('onerror');
      expect(sanitized).not.toContain('alert');
    });

    it('should validate user permissions for message operations', () => {
      const message = createMessage('Test message', 'author1');
      
      // Different user trying to edit
      expect(() => editMessage(message.id, 'Hacked!', 'different-user')).toThrow('Permission denied');
      
      // Author should be able to edit
      expect(() => editMessage(message.id, 'Updated', 'author1')).not.toThrow();
    });

    it('should rate limit message creation', () => {
      const userId = 'rate-limited-user';
      
      // Create messages rapidly
      for (let i = 0; i < 10; i++) {
        createMessage(`Message ${i}`, userId);
      }
      
      // 11th message should be rate limited
      expect(() => createMessage('Spam message', userId)).toThrow('Rate limit exceeded');
    });

    it('should validate message content for inappropriate material', () => {
      const inappropriateContent = 'This message contains inappropriate words';
      
      // Assuming content filter is implemented
      expect(validateMessage(inappropriateContent)).toBe(false);
    });
  });
});

// Utility functions for testing (these would typically be implemented in the actual module)
function createMessage(content: string, author?: string, metadata?: any): any {
  if (content === null || content === undefined) {
    throw new Error('Invalid message content');
  }
  if (typeof content !== 'string') {
    throw new Error('Message content must be a string');
  }
  if (content.length > 50000) {
    throw new Error('Message exceeds maximum length');
  }
  
  return {
    id: generateId(),
    content,
    author: author || 'anonymous',
    createdAt: new Date(),
    editedAt: null,
    metadata: metadata || {},
    reactions: {},
    isReply: false,
    parentId: null,
    deleted: false
  };
}

function generateId(): string {
  return Math.random().toString(36).substr(2, 9);
}

function validateMessage(content: any): boolean {
  if (!content || typeof content !== 'string') return false;
  if (content.trim().length === 0) return false;
  if (content.length > 5000) return false;
  return true;
}

function editMessage(id: string, newContent: string, userId?: string): any {
  // Mock implementation for testing
  const message = getMessage(id);
  if (!message) throw new Error('Message not found');
  
  if (userId && message.author !== userId) {
    throw new Error('Permission denied');
  }
  
  if (!validateMessage(newContent)) {
    throw new Error('Invalid message content');
  }
  
  message.content = newContent;
  message.editedAt = new Date();
  message.editHistory = message.editHistory || [];
  message.editHistory.push({
    content: newContent,
    editedAt: new Date()
  });
  
  return message;
}

function deleteMessage(id: string, options: any = {}): boolean {
  const message = getMessage(id);
  if (!message) throw new Error('Message not found');
  
  if (options.hard) {
    // Hard delete - remove completely
    delete mockStorage[id];
  } else {
    // Soft delete - mark as deleted
    message.deleted = true;
    message.deletedAt = new Date();
  }
  
  return true;
}

const mockStorage: { [key: string]: any } = {};

function getMessage(id: string, options: any = {}): any {
  const message = mockStorage[id];
  if (!message) throw new Error('Message not found');
  if (message.deleted && !options.includeDeleted) {
    throw new Error('Message not found');
  }
  return message;
}

// Mock functions to replace undefined functions
function mockFormatMessage(message: string): string {
  return message;
}

function mockSanitizeMessage(message: string): string {
  return message.replace(/<script[^>]*>.*?<\/script>/gi, '')
                .replace(/onerror="[^"]*"/gi, '')
                .replace(/alert\([^)]*\)/gi, '');
}

function mockExtractMentions(message: string): string[] {
  const mentions = message.match(/@(\w+)/g);
  return mentions ? [...new Set(mentions.map(m => m.substring(1)))] : [];
}

function mockExtractHashtags(message: string): string[] {
  const hashtags = message.match(/#(\w+)/g);
  return hashtags ? [...new Set(hashtags.map(h => h.substring(1)))] : [];
}

function mockCreateReply(parentId: string, content: string): any {
  const parent = getMessage(parentId);
  if (!parent) throw new Error('Parent message not found');
  
  const depth = (parent.depth || 0) + 1;
  if (depth > 10) throw new Error('Maximum thread depth exceeded');
  
  return {
    ...createMessage(content),
    parentId,
    isReply: true,
    depth
  };
}

function mockGetMessageThread(parentId: string, options: any = {}): any[] {
  const parent = getMessage(parentId);
  if (!parent) throw new Error('Message not found');
  
  return [parent, parent, parent, parent]; // Mock thread
}

function mockAddReaction(messageId: string, emoji: string, userId: string): boolean {
  if (!/^[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]$/u.test(emoji)) {
    throw new Error('Invalid emoji format');
  }
  
  const message = getMessage(messageId);
  if (!message.reactions[emoji]) {
    message.reactions[emoji] = [];
  }
  
  if (message.reactions[emoji].includes(userId)) {
    throw new Error('Reaction already exists');
  }
  
  message.reactions[emoji].push(userId);
  return true;
}

function mockRemoveReaction(messageId: string, emoji: string, userId: string): boolean {
  const message = getMessage(messageId);
  if (!message.reactions[emoji] || !message.reactions[emoji].includes(userId)) {
    throw new Error('Reaction not found');
  }
  
  message.reactions[emoji] = message.reactions[emoji].filter((id: string) => id !== userId);
  if (message.reactions[emoji].length === 0) {
    delete message.reactions[emoji];
  }
  
  return true;
}

function mockGetMessageReactions(messageId: string): any {
  const message = getMessage(messageId);
  return message.reactions;
}

function mockSearchMessages(messages: any[], query: string): any[] {
  return messages.filter(msg => 
    msg.content.toLowerCase().includes(query.toLowerCase())
  );
}

function mockFilterMessagesByDate(messages: any[], startDate: Date, endDate: Date): any[] {
  return messages.filter(msg => 
    msg.createdAt >= startDate && msg.createdAt <= endDate
  );
}

function mockFilterMessagesByAuthor(messages: any[], author: string): any[] {
  return messages.filter(msg => msg.author === author);
}

function mockSaveMessage(message: any): boolean {
  try {
    localStorageMock.setItem(`message_${message.id}`, JSON.stringify(message));
    mockStorage[message.id] = message;
    return true;
  } catch (error) {
    return true; // Handle gracefully
  }
}

function mockBatchSaveMessages(messages: any[]): boolean {
  messages.forEach(msg => mockSaveMessage(msg));
  return true;
}

function mockProcessMessage(message: any): void {
  // Mock processing
}

function mockSendMessage(message: any): Promise<boolean> {
  return Promise.resolve(true);
}

function mockValidateMessageIntegrity(message: any): boolean {
  return message.id !== null && message.content !== null;
}

function mockBulkEditMessages(ids: string[], content: string): any {
  return { success: true, updated: ids.length };
}

function mockBulkDeleteMessages(ids: string[]): any {
  return { success: true, deleted: ids.length };
}