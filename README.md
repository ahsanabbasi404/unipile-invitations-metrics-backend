# UniPile Metrics Backend Service

A Node.js + TypeScript backend service that demonstrates UniPile-style invitation ingestion with idempotent storage, daily rollups, and chart-ready JSON output using Firestore.

## Overview

This service exposes a single endpoint that:
- Fetches invitation data from a mock UniPile API
- Stores raw invitations idempotently in Firestore
- Creates daily rollup metrics
- Returns chart-ready JSON with zero-filled days and previous period comparison

## API Endpoint

### GET `/metrics/invitations/daily`

Retrieves daily invitation metrics for a specified tenant, account, and date range.

**Query Parameters:**
- `tenantId` (required): Tenant identifier
- `accountId` (required): Account identifier  
- `from` (required): Start date in YYYY-MM-DD format (inclusive)
- `to` (required): End date in YYYY-MM-DD format (inclusive)

**Example Request:**
```
GET /metrics/invitations/daily?tenantId=demoTenant&accountId=demoAccount&from=2025-09-01&to=2025-09-07
```

**Response Format:**
```json
[
  { "date": "2025-09-01", "value": 3, "status": "ok", "previousPeriodComparison": 8 },
  { "date": "2025-09-02", "value": 0, "status": "ok" },
  { "date": "2025-09-03", "value": 2, "status": "ok" },
  { "date": "2025-09-04", "value": 1, "status": "ok" },
  { "date": "2025-09-05", "value": 4, "status": "ok" },
  { "date": "2025-09-06", "value": 0, "status": "ok" },
  { "date": "2025-09-07", "value": 2, "status": "ok" }
]
```

## Firestore Data Structure

### Raw Invitations Collection
**Path:** `invitations/{externalId}`

**Document Structure:**
```json
{
  "tenantId": "demoTenant",
  "accountId": "demoAccount", 
  "externalId": "inv_abc123_20250901_0",
  "receivedAt": "2025-09-01T08:30:00.000Z"
}
```

### Daily Rollups Collection
**Path:** `metrics/{tenantId}/accounts/{accountId}/daily/{YYYY-MM-DD}`

**Document Structure:**
```json
{
  "date": "2025-09-01",
  "invitationsCount": 3,
  "status": "ok",
  "updatedAt": "2025-09-01T12:00:00.000Z"
}
```

## Key Features

### Idempotent Storage
- Raw invitations use `externalId` as the document ID
- Repeated ingestion of the same data is harmless (no duplicates)
- Uses Firestore's `set(..., { merge: true })` for safe overwrites

### Zero-Filled Data
- Missing days in the requested range are filled with `value: 0`
- Ensures consistent chart rendering with no gaps

### Previous Period Comparison
- Calculates total invitations for the 7 days before the requested range
- Useful for period-over-period analysis

### UTC Date Handling
- All date operations are performed in UTC
- Prevents timezone-related inconsistencies

## How to Run

### Prerequisites
- Node.js 18+
- Firebase project with Firestore enabled

### Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the development server:**
   ```bash
   npm run dev
   ```

   The service is pre-configured with Firebase credentials and will connect to production Firestore.

3. **Test the endpoint:**
   ```bash
   curl "http://localhost:3000/metrics/invitations/daily?tenantId=demoTenant&accountId=demoAccount&from=2025-09-01&to=2025-09-07"
   ```

### Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Compile TypeScript to JavaScript
- `npm run start` - Run compiled JavaScript (production)

## Extending to Other Metrics

To add support for another metric type (e.g., messages), follow this pattern:

### 1. Raw Data Collection
Create a new collection for raw messages:
```
messages/{externalId} → {
  tenantId: string,
  accountId: string, 
  externalId: string,
  receivedAt: string
}
```

### 2. Daily Rollups
Create rollups at:
```
metrics/{tenantId}/accounts/{accountId}/daily/{YYYY-MM-DD} → {
  date: string,
  messagesCount: number,
  status: "ok",
  updatedAt: string
}
```

### 3. API Endpoint
Add a new route:
```
GET /metrics/messages/daily?tenantId=...&accountId=...&from=...&to=...
```

### 4. Implementation Steps
1. Create mock data generator in `src/unipile/mock.ts`
2. Add Firestore helpers in `src/lib/firestore.ts`
3. Create route handler in `src/routes/metrics.ts`
4. Register route in `src/index.ts`

## Architecture

```
src/
├── index.ts              # Express server bootstrap
├── routes/
│   └── metrics.ts        # API route handlers
├── lib/
│   ├── firestore.ts      # Firestore initialization & helpers
│   └── date.ts           # UTC date utilities
└── unipile/
    └── mock.ts           # Mock UniPile API
```

## Error Handling

The API returns appropriate HTTP status codes:

- `200` - Success
- `400` - Invalid query parameters
- `500` - Internal server error

Error responses include details:
```json
{
  "error": "Invalid query parameters",
  "details": "from date must be less than or equal to to date"
}
```

## Development Notes

- All dates are handled in UTC to prevent timezone issues
- Mock data is deterministic based on tenant/account/date for consistent testing
- Firestore writes are batched for performance
- The service supports both emulator and production Firestore environments

## Health Check

The service includes a health check endpoint:
```
GET /health
```

Returns:
```json
{
  "status": "ok",
  "timestamp": "2025-09-01T12:00:00.000Z",
  "service": "unipile-metrics-backend"
}
```