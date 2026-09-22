# Supabase Auth settings for Gazak-Go

These hosted settings are required in addition to the application code. Do not
put SMTP credentials in this repository.

## URL configuration

Set the production Site URL to:

`https://abdullahalbalawi.github.io/gazak-go/`

Allow these exact redirect URLs:

- `https://abdullahalbalawi.github.io/gazak-go/accept-invite`
- `https://abdullahalbalawi.github.io/gazak-go/confirm-email`
- `https://abdullahalbalawi.github.io/gazak-go/reset-password`

If Google OAuth must return to arbitrary protected routes, also allow:

`https://abdullahalbalawi.github.io/gazak-go/**`

Add localhost equivalents only for the ports actually used during development.

## Email delivery

Enable email/password sign-up and email confirmation. Configure a custom SMTP
provider for production delivery. Supabase's default SMTP service only sends to
pre-authorized members of the project's team and is not intended for customer
email delivery.

The **Confirm signup** email template must include `{{ .Token }}` because the
registration screen asks the customer for the six-digit code. It may also keep
`{{ .ConfirmationURL }}` as a fallback confirmation link.

The **Invite user** template must use `{{ .ConfirmationURL }}`. Do not build the
invite link from `{{ .SiteURL }}` alone because that omits the verification
token and the requested `/accept-invite` redirect.

After configuring SMTP, verify the sender domain/address with the provider and
check Supabase Auth logs for rejected or rate-limited deliveries.
