# @buydy/se-logger

High-performance structured logging system for Buydy backend Node.js services.

## Features

- **Two log levels**: `business` (production-safe) and `debug` (development)
- **Zero-cost when disabled**: Debug logs are completely skipped when DEBUG_MODE is false
- **High performance**: Uses direct stdout writes and shallow metadata inspection
- **Structured output**: JSON format for easy parsing and log aggregation
- **Non-blocking I/O**: Minimal string operations and fast serialization
- **🔒 Automatic secret filtering**: Automatically redacts passwords, tokens, keys, and other sensitive data
- **🛡️ Production-safe**: Never logs sensitive information in production environments

## Installation

```bash
yarn add @buydy/se-logger
```

## Usage

```javascript
import logger from '@buydy/se-logger';

// Business logs - always active (production-safe)
logger.business('Order placed', { orderId: 1039, userId: 'user_123' });

// Debug logs - only active when DEBUG_MODE=true
logger.debug('Database query executed', { duration: 48, query: 'SELECT ...' });

// 🔒 Automatic secret filtering - sensitive data is automatically redacted
logger.business('Database connected', { 
  url: 'mongodb://user:password123@host:27017/db',
  apiKey: 'sk-1234567890abcdef',
  password: 'secret123'
});
// Output: Database connected { url: 'mongodb://user:[REDACTED]@host:27017/db', apiKey: '[REDACTED]', password: '[REDACTED]' }

// 🛡️ Safe connection logging
logger.connection('MongoDB connected', 'mongodb://admin:secret@localhost:27017/db');

// Named imports
import { business, debug, safe, connection } from '@buydy/se-logger';
business('Payment processed', { amount: 99.99 });
debug('Cache hit', { key: 'user:123' });
```

## Log Levels

### business
- **Purpose**: Production-safe logs for business events, analytics, and monitoring
- **Always enabled**: Logs are written regardless of DEBUG_MODE
- **Use cases**: User actions, API requests, system events, errors, startup/shutdown

### debug
- **Purpose**: Detailed logs for development and debugging
- **Conditionally enabled**: Only logs when DEBUG_MODE=true
- **Use cases**: Query details, cache operations, internal state, performance metrics

## Configuration

Control debug logging via the `DEBUG_MODE` environment variable:

```bash
# Production - business logs only
DEBUG_MODE=false node app.js

# Development - all logs
DEBUG_MODE=true node app.js
```

### Yarn Scripts

```json
{
  "scripts": {
    "start": "DEBUG_MODE=false node src/index.js",
    "dev": "DEBUG_MODE=true node --watch src/index.js"
  }
}
```

## Output Format

All logs are output as JSON for easy parsing:

```json
{"time":"2025-10-11T14:23:45.123Z","level":"business","message":"Server started { port: 3001 }"}
{"time":"2025-10-11T14:23:46.456Z","level":"debug","message":"Query executed { duration: 23 }"}
```

## Performance

- **Early return**: Debug logs return immediately when disabled
- **Direct stdout**: Bypasses console.log overhead
- **Shallow inspection**: Metadata depth limited to 1 level
- **Minimal formatting**: Only format when needed
- **Zero dependencies**: Uses only Node.js built-ins

## Migration from console.log

```javascript
// Before
console.log('Server started on port', 3001);
console.error('Failed to connect:', error);
console.log('Query result:', result);

// After
import logger from '@buydy/se-logger';
logger.business('Server started', { port: 3001 });
logger.business('Failed to connect', { error: error.message });
logger.debug('Query result', { result });
```

## 🔒 Security Features

### Automatic Secret Filtering

The logger automatically detects and redacts sensitive information:

**Filtered Fields:**
- `password`, `passwd`, `pwd`
- `secret`, `secrets`
- `token`, `tokens`, `auth_token`, `access_token`
- `key`, `api_key`, `private_key`
- `credential`, `credentials`
- `session`, `sessionid`
- `authorization`, `auth`
- And many more...

**Example:**
```javascript
logger.business('User login', {
  username: 'john_doe',
  password: 'super_secret_123',
  apiKey: 'sk-1234567890abcdef',
  token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
});
// Output: User login { username: 'john_doe', password: '[REDACTED]', apiKey: '[REDACTED]', token: '[REDACTED]' }
```

### Safe Connection Logging

Use `connection()` for database URLs and connection strings:

```javascript
logger.connection('Database connected', 'mongodb://admin:secret@localhost:27017/db');
// Output: Database connected { url: 'mongodb://admin:[REDACTED]@localhost:27017/db' }
```

## API

### `business(message, meta?)`
Log a business event (always enabled).

**Parameters:**
- `message` (string): Main log message
- `meta` (any, optional): Additional metadata

### `debug(message, meta?)`
Log debug information (only when DEBUG_MODE=true).

**Parameters:**
- `message` (string): Main log message
- `meta` (any, optional): Additional metadata

### `safe(level, message, meta?)`
Explicitly safe logging (same as regular logging, but emphasizes security).

**Parameters:**
- `level` (string): 'business' or 'debug'
- `message` (string): Main log message
- `meta` (any, optional): Additional metadata

### `connection(message, url, meta?)`
Log connection details with automatic URL filtering.

**Parameters:**
- `message` (string): Main log message
- `url` (string): Connection URL (passwords will be filtered)
- `meta` (any, optional): Additional metadata

### `log(level, message, meta?)`
Generic log function.

**Parameters:**
- `level` (string): 'business' or 'debug'
- `message` (string): Main log message
- `meta` (any, optional): Additional metadata

## License

MIT

