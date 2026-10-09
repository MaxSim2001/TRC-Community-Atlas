# Functional coverage inspired by IT documentation platforms

Review date: **October 5, 2026**

This document records the use cases selected for TRC Community Atlas. Atlas
does not copy IT Glue code, text, or visual identity. Public product and help
material was used only to understand common categories of IT documentation.

Reference sources:

- https://www.itglue.com/features/
- https://help.itglue.kaseya.com/help/Content/1-admin/getting-started/best-practices-for-using-it-glue.htm
- https://help.itglue.kaseya.com/help/Content/2-using/get-to-know-it-glue/introduction-to-the-key-concepts.html
- https://api.itglue.com/developer/

## Atlas coverage

| Area | Atlas implementation |
| --- | --- |
| Core assets | Configurations, checklists, contacts, documents, technical-account load, Domain Tracker, locations, passwords, and SSL Tracker |
| Apps and services | 22 supplied modules, including Microsoft 365 and wireless documentation |
| Structured record types | 148 additional module definitions available as an optional library |
| Navigation | Manage Modules, grouped navigation, collapsible tool sections, presets, and per-account preferences |
| Records | Real counts, organization and state filtering, pagination, create/edit forms, ownership, due date, reference, tags, notes, and archives |
| Search | Global or active-organization scope, accent-insensitive metadata search, and direct editing according to role; vault plaintext is excluded |
| Documentation | Organizations, locations, configurations, procedures/SOPs, relationships, versions, and activity history |
| Universal relationships | Typed, bidirectional same-organization links across modules, sites, procedures, and permitted vault metadata |
| Universal detail page | Full-page details, attachments, related items, impact, history, and security while preserving Atlas navigation |
| Attachments | Local upload, download, and removal with author/date audit, size limits, executable-file refusal, and recent MFA for password records |
| Mentions | `@record-name` in procedures and notes with an active-organization selector and automatic reverse relation |
| Impact analysis | Multi-level dependent and dependency traversal |
| Local security | Atlas-owned accounts, roles, MFA, sessions, and organization scopes with no TRC Account dependency |
| Vault | AES-256-GCM secrets, separate local key, session-bound MFA unlock, manual lock, explicit reveal, and on-demand OTP |
| Scale | Pagination and search for large collections; deterministic local QA data above 1,300 records |
| Resilience | SQLite WAL transactions, rotating history, durable record revisions, audit, rollback-preserving import, and versioned documentation export |
| Standardization | Templates, structured checklists, reusable module definitions, and local workflow thresholds |
| MSP use | Unlimited organizations and child organizations, separate permissions and vaults, and no per-client or per-technician license limit |

Reference screenshot counts were not imported. Every Atlas counter comes only
from the local instance's own authorized data.

## Explicit boundaries

- Vault plaintext is encrypted at rest and excluded from normal documentation
  exports. Complete protection still depends on Windows account security, disk
  encryption, and protected backups.
- A module's presence does not enable an RMM, PSA, Microsoft 365, Network Glue,
  public API, webhook, or discovery integration.
- Any future TRC Community RMM connector or SSO remains optional, unconfigured,
  and reserved for a dedicated final phase.
- External commercial features from another platform are not represented as
  operational when Atlas does not implement them.
- Simultaneous collaborative editing is outside the current local scope.
- Binary attachments are local and are not included in documentation-only JSON
  export; full backups protect them.
- Atlas is source-available and autonomous, not a hosted service operated by
  TheRisingCloud.
