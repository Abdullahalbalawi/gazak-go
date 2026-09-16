# Gazak Go

Current source snapshot prepared for GitHub.

## Important

This repository is a source-code backup/development copy of the current Gazak Go project.
The application currently contains dependencies on Base44 services (authentication,
entities/database access, and backend functions). Uploading this repository to GitHub
does not by itself make the application independent of Base44.

## Recommended migration path

1. Keep this repository as the source-control baseline.
2. Verify the project builds locally.
3. Gradually replace Base44 authentication, data access, and backend functions.
4. Move the backend/database to an independent service such as Supabase.
5. Deploy the frontend independently (for example, Vercel).
6. Run end-to-end tests before discontinuing Base44.

## Safety

Never commit production API keys, service-role keys, passwords, or other secrets.
