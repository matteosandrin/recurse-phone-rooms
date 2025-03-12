# Recurse Center Phone Booking System

A simple application for Recurse Center participants to book phone rooms for calls, interviews, or meetings. This system provides an intuitive interface for viewing and booking available rooms while preventing scheduling conflicts.

## Features

- OAuth authentication with Recurse Center
- View available phone rooms with color-coded display
- Book time slots for phone rooms with drag-and-drop interface
- See existing bookings in a weekly calendar view
- Prevent double-bookings with built-in validation
- Authentication-protected API endpoints for secure booking management

## Technology Stack

- **Frontend**: Svelte with TypeScript
- **Styling**: Tailwind CSS for responsive design
- **Calendar**: Custom calendar implementation with time slot selection
- **Backend**: Express.js REST API
- **Database**: PostgreSQL
- **Development**: Vite for fast development and building
- **Testing**: Playwright for end-to-end tests, custom API tests

## Prerequisites

- Node.js (v16+)
- PostgreSQL database
- Recurse Center OAuth application credentials

## Setup

1. Clone the repository:

```bash
git clone https://github.com/TreyLawrence/recurse-bookings.git
cd recurse-bookings
```

2. Install dependencies:

```bash
npm install
```

3. Create a Recurse Center OAuth application:
   - Go to https://www.recurse.com/settings/apps
   - Create a new OAuth application
   - Set the redirect URI to `http://localhost:5173/oauth/callback`
   - Note your client ID and client secret

4. Configure your environment variables:
   - Copy `.env` to `.env.local` (which will not be committed to git)
   - Fill in your database details and Recurse Center OAuth credentials

```
VITE_DB_USER=your_db_user
VITE_DB_HOST=your_db_host
VITE_DB_NAME=your_database_name
VITE_DB_PASSWORD=your_db_password
VITE_DB_PORT=5432
VITE_DB_SSL=true

# Recurse Center OAuth
VITE_RECURSE_CLIENT_ID=your_recurse_client_id
VITE_RECURSE_CLIENT_SECRET=your_recurse_client_secret
VITE_OAUTH_REDIRECT_URI=http://localhost:5173/oauth/callback
```

5. Set up PostgreSQL service configuration (optional but recommended):

```bash
npm run setup:pg-service
```

This creates a configuration file that simplifies database connections across different environments (local development, testing, and production). The script will:
   - Create a ~/.pg_service.conf file from the template
   - Test connections to the local and test databases
   - Provide guidance for setting up production credentials

For more information about the PostgreSQL service configuration, see [docs/database-services.md](docs/database-services.md).

6. Run the database migrations:

```bash
npm run migrate
```

7. Start the development server:

```bash
npm run dev:all
```

8. Open http://localhost:5173 in your browser

## Project Structure

```
recurse-bookings/
├── src/                  # Frontend Svelte application
│   ├── lib/              # Shared utility code
│   │   ├── auth.ts       # Authentication utilities
│   │   └── browserDb.ts  # Database API client
│   ├── routes/           # Svelte components for routes
│   └── App.svelte        # Main application component
├── server/               # Backend Express API
│   ├── index.js          # Main server file and API routes
│   └── db.js             # Database connection and queries
├── migrations/           # Database migration scripts
├── tests/                # Test files
│   ├── api/              # API tests
│   └── e2e/              # End-to-end tests with Playwright
└── playwright.config.ts  # Playwright configuration
```

## Database Schema

The application uses three main tables:

- `users`: Stores user information from Recurse Center (id, email, name, recurse_id)
- `rooms`: Lists available phone rooms (id, name, description, capacity)
- `bookings`: Tracks room reservations (id, user_id, room_id, start_time, end_time, notes)

## Testing

The application includes both API tests and end-to-end tests:

### Running API Tests

```bash
npx playwright test tests/api/
```

These tests verify the backend API functionality including booking creation, availability checking, and permission validation.

### Running End-to-End Tests

```bash
npx playwright test tests/e2e/
```

End-to-end tests use Playwright to simulate user interactions in a browser environment, testing the entire application flow.

## Development

### Available Scripts

- `npm run dev:all`: Start both the frontend and backend servers
- `npm run dev`: Start only the frontend development server
- `npm run server`: Start only the backend server
- `npm run build`: Build for production
- `npm run preview`: Preview the production build
- `npm run check`: Type-check the code
- `npm run migrate`: Run database migrations
- `npm test`: Run all tests
- `npm run test:ui`: Run tests with Playwright UI mode

## Deploying to Production

1. Set up a PostgreSQL database
2. Update the Recurse Center OAuth redirect URI to your production URL
3. Set environment variables for production
4. Build the application: `npm run build`
5. Deploy the built files from the `dist` directory to your hosting service

## License

MIT
# Test change
