# Gazak Go

Responsive RTL gas-cylinder delivery application.

## Current migration status
The project is being migrated from Base44 to an independent stack based on Supabase + Vite/React.

### Completed
- Supabase client added.
- Authentication context migrated to Supabase Auth.
- Login, registration and password recovery migrated to Supabase Auth.
- Initial PostgreSQL schema and RLS migration added.
- Environment template switched to Supabase variables.

### In progress
- Replace remaining Base44 entity/function calls with Supabase queries/RPC/Edge Functions.
- Remove the Base44 Vite plugin and SDK completely.
- Implement transactional order + inventory workflows.
- Implement automated dispatch rules, including busy-driver and route-delay protection.

Do not remove the remaining Base44 compatibility files until all application references have been migrated and verified.