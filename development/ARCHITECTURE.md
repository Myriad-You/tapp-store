# Architecture Overview

## System Architecture

Myriad is built as a modern full-stack application with a clear separation between frontend and backend, communicating via RESTful APIs.

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend                             │
│              Astro + React + Tailwind CSS                    │
│                   (Port 4321)                                │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTP/REST API
                     │
┌────────────────────▼────────────────────────────────────────┐
│                         Backend                              │
│                  Rust + Axum + SeaORM                        │
│                    (Port 3000)                               │
└────────┬──────────────────────────┬────────────────────┬────┘
         │                          │                    │
         │                          │                    │
    ┌────▼────┐              ┌──────▼──────┐      ┌────▼────┐
    │  GitHub │              │   Twitter   │      │ LinkedIn│
    │   API   │              │     API     │      │   API   │
    └─────────┘              └─────────────┘      └─────────┘
         │                          │                    │
         └──────────────────────────┴────────────────────┘
                                   │
                          ┌────────▼─────────┐
                          │   PostgreSQL     │
                          │    Database      │
                          └──────────────────┐
                                   │
                          ┌────────▼─────────┐
                          │ Google Gemini  │
                          │  (AI Analysis)  │
                          └──────────────────┘
```

## Components

### Frontend (Astro + React)

**Location**: `frontend/`

The frontend is built with Astro, a modern static site generator that allows for fast, content-focused websites with minimal JavaScript. React is used for interactive components.

**Key Features:**

- Server-side rendering for fast initial loads
- React islands for interactive components
- Tailwind CSS for styling
- TypeScript for type safety
- Vite as the build tool

**Structure:**

```
frontend/
├── src/
│   ├── pages/           # Route-based pages
│   ├── components/      # React/Astro components
│   ├── layouts/         # Page layouts
│   ├── lib/             # Utilities and API client
│   └── styles/          # Global styles
├── public/              # Static assets
└── astro.config.mjs     # Astro configuration
```

### Backend (Rust + Axum)

**Location**: `backend/`

The backend is built with Rust for performance, safety, and reliability. Axum provides a modern async web framework, while SeaORM handles database operations.

**Key Features:**

- Async/await for concurrent operations
- Type-safe database queries with SeaORM
- RESTful API design
- CORS support for frontend communication
- Structured error handling
- Comprehensive logging with tracing

**Structure:**

```
backend/
├── src/
│   ├── main.rs          # Application entry point
│   ├── api/             # API route handlers
│   │   ├── config.rs    # Configuration endpoints
│   │   ├── platforms.rs # Platform management
│   │   └── analysis.rs  # AI analysis endpoints
│   ├── services/        # Business logic
│   │   ├── fetcher.rs   # Platform data fetching
│   │   ├── analyzer.rs  # AI analysis
│   │   └── generator.rs # Content generation
│   ├── models/          # Data models & entities
│   ├── db/              # Database connection
│   ├── config.rs        # Configuration management
│   └── error.rs         # Error types
└── migrations/          # Database migrations
```

### Database (PostgreSQL)

**Location**: `database/`

PostgreSQL is used for its reliability, advanced features (JSONB, full-text search), and excellent support for complex queries.

**Core Tables:**

- `platforms` - Supported social platforms
- `user_profiles` - User profile data from platforms
- `user_activities` - User activities and posts
- `analysis_results` - AI-generated analyses
- `configurations` - System configuration
- `api_keys` - Encrypted API key storage
- `fetch_jobs` - Background job tracking

**Schema Management:**

- SQL schema in `database/schema.sql`
- SeaORM migrations in `backend/migrations/`
- Automated migration runner

## Data Flow

### 1. Platform Data Fetching

```
User → Frontend → Backend API → Platform Fetcher Service
                                        ↓
                                  External API
                                  (GitHub, etc.)
                                        ↓
                                  Parse & Store
                                        ↓
                                   Database
```

### 2. AI Analysis

```
User → Frontend → Backend API → Analyzer Service
                                        ↓
                                   Fetch Data
                                   from Database
                                        ↓
                              Google Gemini API
                                        ↓
                                  Store Results
                                        ↓
                                   Database
```

### 3. Data Display

```
User → Frontend → Backend API → Database Query
                                        ↓
                                  Format Response
                                        ↓
                    Frontend Renders Components
```

## Security Considerations

### API Key Management

- API keys stored encrypted in database
- Environment variables for sensitive data
- Never exposed to frontend
- Rotation support

### Data Privacy

- User data stored locally or in controlled environment
- No third-party analytics by default
- Configurable data retention

### Network Security

- CORS configuration for API access
- HTTPS recommended for production
- Rate limiting on API endpoints (planned)

## Scalability

### Current Design

- Monolithic architecture suitable for single-user or small team use
- Single PostgreSQL instance
- All services run on same machine/container

### Future Scaling Options

1. **Horizontal Scaling**

   - Multiple backend instances behind load balancer
   - Shared PostgreSQL database
   - Redis for session/cache (if needed)

2. **Microservices**

   - Separate services for each platform integration
   - Message queue for async processing
   - Service mesh for inter-service communication

3. **Database Optimization**
   - Read replicas for queries
   - Connection pooling
   - Query optimization with indexes

## Performance Considerations

### Backend

- Async I/O for concurrent API calls
- Connection pooling for database
- Efficient serialization with serde
- Release builds with LTO optimization

### Frontend

- Static generation for fast loads
- Code splitting for smaller bundles
- Image optimization
- CDN for static assets (production)

### Database

- Indexed columns for frequent queries
- JSONB for flexible schema
- Regular VACUUM and ANALYZE
- Query plan analysis

## Deployment Architecture

### Development

```
Local Machine
├── PostgreSQL (Docker or local)
├── Backend (cargo run)
└── Frontend (npm run dev)
```

### Production (Docker)

```
Docker Host
├── PostgreSQL Container
├── Backend Container
│   └── Serves static frontend files
└── Optional: Reverse Proxy (nginx)
```

### Production (Traditional)

```
Server
├── PostgreSQL Service
├── Backend Binary
│   └── Systemd service
└── Static Files (served by backend)
```

## Technology Choices Rationale

### Why Rust?

- Memory safety without garbage collection
- Excellent performance
- Strong type system prevents many bugs
- Great ecosystem for web development
- Efficient resource usage

### Why Astro?

- Fast by default (minimal JS)
- Flexible (supports multiple frameworks)
- Great developer experience
- SEO-friendly
- Modern build tools

### Why PostgreSQL?

- ACID compliance
- JSONB for flexible data storage
- Rich query capabilities
- Proven reliability
- Excellent documentation

### Why SeaORM?

- Async from ground up
- Type-safe queries
- Migration management
- Multi-database support
- Active development

## Development Workflow

1. **Local Development**

   - Use `./scripts/dev.ps1` to start both servers
   - Backend proxies to frontend in development
   - Hot reload for both frontend and backend

2. **Testing**

   - Unit tests for backend services
   - Integration tests for API endpoints
   - Frontend component tests (planned)

3. **Building**

   - `./scripts/build.ps1` creates production builds
   - Frontend compiled to static files
   - Backend compiled with optimizations

4. **Deployment**
   - Docker Compose for easy deployment
   - Or traditional server deployment
   - Database migrations run automatically

## Future Enhancements

- [ ] GraphQL API option
- [ ] WebSocket for real-time updates
- [ ] Background job queue (e.g., with Tokio tasks)
- [ ] Plugin system for custom platforms
- [ ] Multi-user support with authentication
- [ ] API rate limiting and caching
- [ ] Comprehensive monitoring and metrics
- [ ] Automated backups
