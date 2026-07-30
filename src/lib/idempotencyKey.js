const { randomUUID } = require("crypto");

/**
 * Generates a unique storage key for create requests whose caller did not
 * provide an idempotency key. Caller-provided keys still take precedence and
 * are used by the services to deduplicate retries.
 */
function generateIdempotencyKey() {
  return randomUUID();
}

module.exports = { generateIdempotencyKey };
