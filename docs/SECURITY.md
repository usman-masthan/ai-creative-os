# Security and Data Handling

## Public repository rule

This repository is public. Never commit:

- API keys or credentials
- private client documents
- unpublished commercial offers
- beneficiary-identifying data
- consent records
- private photographs
- internal financial information
- sensitive campaign material
- private analytics exports

## Tenant isolation

Every persisted or generated object must carry a `tenantId`. Cross-tenant reads must be rejected by application logic and later by database/storage policy.

## Lifeline-specific handling

Humanitarian content requires stricter review. Do not publish invented statistics, beneficiary counts, donation claims, or sensitive personal stories. Where consent is required, publication must remain blocked until consent status is verified.

## Secrets

Use environment variables or a secrets manager. `.env` is ignored; `.env.example` contains names only.

## Generated media

Do not rely on image/video models to render critical facts such as price, date, legal text, phone number, or donation amount. Add those deterministically after generation.

## Future hardening

Before any client-facing SaaS release:

1. Add authentication.
2. Add role-based access control.
3. Add row-level tenant isolation.
4. Add audit logs.
5. Add signed/private media URLs.
6. Add secret rotation.
7. Add approval history.
8. Add backup and recovery procedures.
