# Provd — Project Context

## What this app is
Provd is a social dare challenge app. Friends dare each other to complete
real-world tasks, submit photo or video proof, and earn points toward a
monthly crown. There is also an Arena mode where strangers dare each other.

## Tech stack
- React Native with Expo and expo-router
- Supabase for database and auth

## Key rules
- Points are always calculated server-side, never client-side
- Each user can hold only 1 active Friends dare at a time
- Dare sender cannot vote on their own proof submission
- Streaks reset on a miss, but weekly swaps do not break streaks
- Arena mode requires age verification flag on user profile

## Folder structure
/app           screens (expo-router file-based routing)
/components    reusable UI components
/lib           utilities, supabase client, helpers
/hooks         custom React hooks
/constants     theme.js, config values
/api           all Supabase calls and API logic

## Naming conventions
- Components: PascalCase (DareCard.js)
- Hooks: camelCase with use prefix (useDareTimer.js)
- API files: camelCase (dareApi.js)
- Database tables: snake_case (dare_submissions)

## Do not change without asking
- constants/theme.js color values
- The points calculation logic once built
- Database schema once established
