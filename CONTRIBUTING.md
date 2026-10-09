# Contributing to TRC Community Atlas

Thank you for helping improve Atlas. Bug reports, proposals, and fixes are
welcome, while the project remains the intellectual property of
TheRisingCloud.

## Ownership of contributions

A pull request can be merged only after its author has signed a copyright
assignment agreement approved by TheRisingCloud. A contributor acting for an
employer must also have the appropriate entity agreement signed.

The assignment allows TheRisingCloud to remain the single project owner,
protect Atlas, and grant separate commercial licenses. The contributor receives
a license back to use the contribution under the current public Atlas
source-available license.

The policy and selected agreement templates are described in
[`docs/CONTRIBUTOR_OWNERSHIP.md`](docs/CONTRIBUTOR_OWNERSHIP.md). No external
contribution may be merged until the maintainer has recorded the signed
agreement privately.

## Contribution rules

- Open an issue before starting a significant change.
- Never include customer data, passwords, private keys, tokens, or backups.
- Use only clearly fictional test data.
- Document changed behavior and add relevant tests.
- Declare all third-party code, assets, and dependencies.
- Preserve Atlas autonomy, local data ownership, and the absence of telemetry.
- Accept that a proposal may be declined, changed, or postponed.

## Validation

Before opening a pull request:

~~~powershell
npm run check
npm test
~~~

The public license is available in [`LICENSE.txt`](LICENSE.txt).
