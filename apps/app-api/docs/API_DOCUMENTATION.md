# Buydy API Documentation

This document contains the complete API structure and endpoints for all Buydy services. It's automatically maintained and should be referenced before any API-related UI development tasks.

**Last Updated:** 2025-10-04  
**API Version:** v1  
**Status:** ✅ Working with Mock Data (MongoDB not required)

---

## 🏗️ Available Services

### 1. Stocks API (`app-stocks-api`)
**Base URL:** `http://localhost:3001/api/v1`  
**Purpose:** Job management and monitoring for stocks scanning system

---

## 📋 Entity: Jobs

### Data Model Structure
```typescript
interface Job {
  _id: string;                    // MongoDB ObjectId
  name: string;                   // Job identifier (required)
  status: 'scheduled' | 'running' | 'completed' | 'failed';
  scheduledAt: Date;              // When job was scheduled
  startedAt?: Date;               // When job started executing
  endedAt?: Date;                 // When job finished
  progress: number;               // 0.0 to 1.0
  result?: any;                   // Job execution result (on success)
  error?: string;                 // Error message (on failure)
  logs: Array<{                   // Job execution logs
    ts: Date;
    level: 'info' | 'warn' | 'error';
    msg: string;
  }>;
  metadata: any;                  // Custom job metadata
}
```

### API Endpoints

#### **1. Get All Jobs** `GET /jobs`
**Description:** Retrieve all jobs with optional filtering and pagination

**Query Parameters:**
- `status` (string, optional) - Filter by status: 'scheduled', 'running', 'completed', 'failed'
- `name` (string, optional) - Filter by name (partial match, case-insensitive)
- `limit` (number, optional) - Number of results (default: 50)
- `skip` (number, optional) - Pagination offset (default: 0)
- `sortBy` (string, optional) - Field to sort by (default: 'scheduledAt')
- `sortOrder` (string, optional) - Sort order: 'asc' or 'desc' (default: 'desc')

**Response:**
```json
{
  "jobs": Job[],
  "pagination": {
    "total": number,
    "limit": number,
    "skip": number,
    "hasMore": boolean
  }
}
```

**Example:**
```bash
GET /api/v1/jobs?status=running&limit=10&sortBy=startedAt&sortOrder=desc
```

#### **2. Get Job by ID** `GET /jobs/:id`
**Description:** Retrieve a specific job by its ID

**Path Parameters:**
- `id` (string, required) - Job MongoDB ObjectId

**Response:**
```json
{
  "job": Job
}
```

**Error Responses:**
- `404` - Job not found

#### **3. Create Job** `POST /jobs`
**Description:** Create a new job

**Request Body:**
```json
{
  "name": string,        // Required - Job identifier
  "metadata": object     // Optional - Custom metadata, defaults to {}
}
```

**Response:** `201 Created`
```json
{
  "job": Job
}
```

**Error Responses:**
- `400` - Validation error (missing name)

#### **4. Update Job** `PUT /jobs/:id`
**Description:** Update job status, progress, or add logs

**Path Parameters:**
- `id` (string, required) - Job MongoDB ObjectId

**Request Body:**
```json
{
  "status"?: 'scheduled' | 'running' | 'completed' | 'failed',
  "progress"?: number,           // 0.0 to 1.0
  "result"?: any,                // For completed jobs
  "error"?: string,              // For failed jobs
  "logMessage"?: string,         // Add log entry
  "logLevel"?: 'info' | 'warn' | 'error'  // Default: 'info'
}
```

**Response:**
```json
{
  "job": Job
}
```

**Error Responses:**
- `404` - Job not found

**Special Behaviors:**
- Setting `status: 'running'` automatically sets `startedAt`
- Setting `status: 'completed'` automatically sets `endedAt` and `progress: 1.0`
- Setting `status: 'failed'` automatically sets `endedAt`

#### **5. Delete Job** `DELETE /jobs/:id`
**Description:** Delete a job

**Path Parameters:**
- `id` (string, required) - Job MongoDB ObjectId

**Response:**
```json
{
  "message": "Job deleted successfully",
  "job": {
    "id": string,
    "name": string
  }
}
```

**Error Responses:**
- `404` - Job not found

#### **6. Get Job Statistics** `GET /jobs/stats`
**Description:** Get aggregated job statistics

**Response:**
```json
{
  "stats": {
    "total": number,
    "scheduled": number,
    "running": number,
    "completed": number,
    "failed": number
  },
  "recentActivity": number  // Jobs scheduled in last 24 hours
}
```

#### **7. Get Recent Jobs** `GET /jobs/recent`
**Description:** Get jobs from the last 24 hours

**Query Parameters:**
- `limit` (number, optional) - Number of results (default: 20)

**Response:**
```json
{
  "jobs": Job[]
}
```

#### **8. Get Running Jobs** `GET /jobs/running`
**Description:** Get currently running jobs

**Response:**
```json
{
  "jobs": Job[]
}
```

#### **9. Get Failed Jobs** `GET /jobs/failed`
**Description:** Get failed jobs, optionally filtered by date

**Query Parameters:**
- `since` (string, optional) - ISO date string to filter since

**Response:**
```json
{
  "jobs": Job[]
}
```

**Example:**
```bash
GET /api/v1/jobs/failed?since=2024-01-01T00:00:00.000Z
```

#### **10. Get Jobs by Type** `GET /jobs/types`
**Description:** Get jobs grouped by type/name with summary statistics

**Query Parameters:**
- `limit` (number, optional) - Number of job types (default: 50)
- `skip` (number, optional) - Number of job types to skip (default: 0)

**Response:**
```json
{
  "jobTypes": [
    {
      "name": "syncFundamentalsLargeCap",
      "totalRuns": 15,
      "runningCount": 2,
      "completedCount": 10,
      "failedCount": 2,
      "scheduledCount": 1,
      "successRate": 67,
      "latestJob": Job
    }
  ],
  "pagination": {
    "total": 5,
    "limit": 50,
    "skip": 0,
    "hasMore": false
  }
}
```

**Example:**
```bash
GET /api/v1/jobs/types?limit=20&skip=0
```

#### **11. Get Job History** `GET /jobs/history/:name`
**Description:** Get historical executions of a specific job name

**Path Parameters:**
- `name` (string, required) - Job name (URL encoded)

**Query Parameters:**
- `limit` (number, optional) - Number of historical jobs (default: 20)

**Response:**
```json
{
  "jobs": Job[]
}
```

**Example:**
```bash
GET /api/v1/jobs/history/syncFundamentalsLargeCap?limit=50
```

---

## 🔧 Common Response Patterns

### Success Response
```json
{
  "data": any,           // Actual response data
  "pagination"?: object  // For paginated responses
}
```

### Error Response
```json
{
  "error": string,       // Error message
  "message"?: string,    // Additional details
  "details"?: any,       // Error details (development only)
  "timestamp": string,   // ISO timestamp
  "path": string         // Request path
}
```

### HTTP Status Codes
- `200` - Success
- `201` - Created
- `400` - Bad Request (validation error)
- `404` - Not Found
- `409` - Conflict (duplicate)
- `500` - Internal Server Error

---

## 🎯 UI Development Guidelines

### For Dashboard Components
- Use `/jobs/stats` for overview cards
- Use `/jobs/recent` for recent activity feed
- Use `/jobs/running` for real-time progress tracking

### For Job Management
- Use `/jobs/types` for job type overview (grouped by name)
- Use `/jobs` with pagination for individual job lists
- Use `/jobs/:id` for job details
- Use `/jobs/history/:name` for job history views (all runs of a specific job type)
- Navigate to job history from job type cards or job details

### For Real-time Updates
- Poll `/jobs/running` every 5-10 seconds
- Use `/jobs/stats` for live statistics
- Update progress bars using `progress` field (0.0-1.0)

### For Job Actions
- **Create:** `POST /jobs`
- **Start:** `PUT /jobs/:id` with `status: 'running'`
- **Stop:** `PUT /jobs/:id` with `status: 'failed'` and error message
- **Delete:** `DELETE /jobs/:id`

### Error Handling
- Always check response status
- Display user-friendly error messages
- Handle network errors gracefully
- Show loading states during API calls

---

## 🔄 API Change Management

### When APIs Change
1. Update this documentation immediately
2. Update the `Last Updated` timestamp
3. Document breaking changes clearly
4. Provide migration examples if needed

### Before API-Related Tasks
1. **ALWAYS** read this documentation first
2. Understand the current API structure
3. Check for any recent changes
4. Plan UI components based on available endpoints

---

## 📝 Notes for Developers

### Authentication
- Currently no authentication required
- CORS enabled for `http://localhost:3000`

### Rate Limiting
- No rate limiting currently implemented
- Consider implementing for production

### WebSocket Support
- Currently polling-based
- Consider WebSocket for real-time updates

### Environment
- Development: `http://localhost:3001`
- Production: TBD

---

**⚠️ Important:** This documentation must be updated whenever API changes are made. Always reference this document before building UI components that interact with APIs.
