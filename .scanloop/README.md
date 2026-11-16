# Local security rules

`rules/local-security.yml` is a limited, offline baseline. It does NOT replace full Semgrep community packs/advanced taint tracking. The installed scanner runs using `--metrics=off --config .scanloop/rules/local-security.yml` and no remote config; Gitleaks scans directory content and OSV checks package lockfiles. OSV normally transmits package names/versions to OSV.dev and needs a separate offline-database setup for zero network egress. If any required scanner is absent or fails, the quality gate FAILS and Codex cannot mark the task Done.
