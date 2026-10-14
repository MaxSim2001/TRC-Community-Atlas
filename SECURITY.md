# Security policy

TRC Community Atlas is self-hosted, source-available software. Each instance
administrator remains responsible for TLS termination, operating-system
hardening, access control, backups, and recovery testing.

## Supported versions

Security fixes are provided on the latest stable release line only. Users
should first reproduce a suspected issue on the latest stable release without
placing production secrets in screenshots, logs, exports, or test data.

## Reporting a vulnerability

Use the repository's **Security** tab and open a private vulnerability report
through GitHub Security Advisories. Include the affected version, exact local
reproduction steps, expected and observed results, and the smallest possible
sanitized evidence set.

Do not open a public issue for an unpatched vulnerability. Never include real
passwords, MFA seeds, recovery codes, API tokens, private keys, customer data,
database files, backup archives, private network addresses, or production
configuration in a report.

If GitHub private vulnerability reporting is unavailable, contact the
repository owner privately through the contact method listed on the official
GitHub profile and disclose only that a security report is waiting. Do not send
the sensitive details through a public channel.

## Response expectations

TheRisingCloud and contributors provide Atlas **AS IS**, without a support or
maintenance obligation. Reports may be acknowledged, investigated, fixed, or
declined at the project's discretion. No service-level agreement or bounty is
offered.

Please allow a reasonable remediation period before public disclosure. The
project will credit reporters who request attribution when doing so does not
increase risk.

## Release integrity

Atlas automatic updates remain blocked unless the release manifest signature,
package size, package SHA-256, target version, free space, MFA confirmation,
health check, and rollback readiness all pass. A self-signed development
certificate is not public Windows trust.

