# TRC Community Atlas user guide

Guide version: **0.15.6**

This guide complements the built-in Help Center available from the `?` icon in
the header. Atlas serves help locally and does not call an external
documentation service.

## Recommended first workflow

1. Open or create an organization.
2. Confirm the active organization in the top selector and breadcrumb.
3. Enable only the modules that the organization needs under **Manage modules**.
4. Add the priority sites, configurations, contacts, and documents.
5. Connect related records from the **Related items** panel.
6. Use Quick Notes only for instructions that should be visible whenever the
   organization home page opens.

## Organization scope

Lists, counts, and new records always follow the active organization. A child
organization has its own sites, records, passwords, and permissions. The
parent-child relationship affects navigation and classification only. It never
merges vault entries or access rights. Hierarchies are limited to three levels.

## Navigation and search

When no organization is selected, Atlas displays only the overview and
organization navigation. After an organization is selected, its enabled
modules appear and the breadcrumb shows the organization path.

The top search can search every accessible organization or one selected
organization. Matching organizations appear before matching records. Vault
secrets are never indexed.

Press `Ctrl+K` to focus global search. In the Help Center, press `/` to focus
documentation search.

## Create and edit records

1. Select the intended organization before selecting **New**.
2. Open the relevant module.
3. Complete the required fields and add useful context rather than placeholder
   text.
4. Add tags and relationships where they improve retrieval.
5. Save the record and confirm that it appears in the active organization.

Atlas does not ask for an organization inside every creation form because the
active organization defines the destination.

## Documents and procedures

The document editor includes Write, Split, and Preview modes, plus full-screen
editing. It supports headings, lists, task lists, tables, block quotes, links,
and code blocks. The `@record-name` syntax can prepare a relationship to a
record in the same organization.

Never copy a password into a document. Create a vault record and relate it to
the document.

## Relationships

Any record can be related to a site, configuration, procedure, password, or
enabled-module record in the same organization. Atlas creates the reverse link
and records additions and removals in activity history.

## Passwords

Password metadata can be read only by accounts with the required organization
and vault permissions. MFA unlocks protected values for the current session;
users do not need to re-enter MFA for every password while that authorized
session remains valid. Viewing and copying a secret is audited.

Password-strength evaluation is calculated when a password is created or
changed and stored as metadata. The plaintext secret is not added to search or
analytics indexes.

## Archive and restore

Archiving removes a record from normal lists without permanently deleting it.
Relationships continue to show the archived state, and authorized users can
restore the record.

## Mobile installation

On a supported mobile browser, Atlas offers installation as a Progressive Web
App. The installation banner does not appear after Atlas is running in the
installed application. Only the static application shell is cached; APIs and
business data always come from the Atlas instance.

## Initial configuration and health

The super administrator can configure hidden Windows startup under **Settings >
Initial configuration** and review the actual task state under **Site health**.
**Test local port** checks only the current Atlas listener on this computer. It
does not scan the LAN or test the firewall. The public-domain test is separate
and explicit.

## Help topics included in Atlas

The built-in Help Center covers:

- concepts and navigation;
- organizations and Quick Notes;
- modules, search, documents, and relationships;
- vault access, password health, accounts, MFA, and sessions;
- attachments, versions, and archives;
- backups, import/export, and mobile PWA use;
- RMM integration boundaries;
- Release notes, diagnostics, and GitHub distribution.

