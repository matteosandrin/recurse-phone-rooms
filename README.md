# Recurse Center Phone Booking System

A simple application for Recurse Center participants to book phone rooms for calls, interviews, or meetings.

## Features

- OAuth authentication with Recurse Center
- View available phone rooms
- Book time slots for phone rooms
- See existing bookings
- Prevent double-bookings

## Technology Stack

- Svelte with TypeScript
- Tailwind CSS for styling
- Event Calendar for the booking interface
- PostgreSQL database
- Vite for development and building

## Prerequisites

- Node.js (v16+)
- PostgreSQL database
- Recurse Center OAuth application credentials

## Setup

1. Clone the repository:

```bash
git clone https://github.com/yourusername/recurse-bookings.git
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

5. Run the database migrations:

```bash
npm run migrate
```

6. Start the development server:

```bash
npm run dev
```

7. Open http://localhost:5173 in your browser

## Database Schema

The application uses three main tables:

- `users`: Stores user information from Recurse Center
- `rooms`: Lists available phone rooms
- `bookings`: Tracks room reservations

## Development

### Available Scripts

- `npm run dev`: Start the development server
- `npm run build`: Build for production
- `npm run preview`: Preview the production build
- `npm run check`: Type-check the code
- `npm run migrate`: Run database migrations

## Deploying to Production

1. Set up a PostgreSQL database
2. Update the Recurse Center OAuth redirect URI to your production URL
3. Set environment variables for production
4. Build the application: `npm run build`
5. Deploy the built files from the `dist` directory to your hosting service

## License

MIT
