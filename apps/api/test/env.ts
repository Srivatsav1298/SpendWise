// Loaded in every test worker BEFORE modules import: points everything at the isolated test database.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgresql://spendwise:spendwise@localhost:5433/spendwise_test?schema=public';
process.env.JWT_ACCESS_SECRET = 'test-secret-test-secret-test-secret-123';
process.env.NODE_ENV = 'test';
process.env.UPLOAD_DIR = require('path').join(require('os').tmpdir(), 'spendwise-test-uploads');
process.env.THROTTLE_LIMIT = '100000';
process.env.AUTH_THROTTLE_LIMIT = '100000';
