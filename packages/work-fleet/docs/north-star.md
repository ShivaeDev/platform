# Work Fleet north star

A maintainer approves Board work. Fleet carries independent items through workers,
reviewers, scoped repair, required validation and authorized delivery. The person
sees work that is active, completed, or needs one concrete decision. Detailed
receipts and evidence remain attached to the work rather than copied into a second
status ledger.

Board is the foundation and remains useful without Fleet. Its Markdown sources
hold stable identity, context, relationships and human questions. Its index and
PubSub are rebuildable observations, not an attempts database. Fleet uses an
ordinary transactional SQL attachment keyed by Board identity. The browser is
optional. There is no separate task queue, daemon-wide decision lock or event journal.

Session services handle one provider conversation and its turns. They do not know
about dependencies or merge authority. Submission intent precedes remote mutation;
acknowledged session and turn identities must be saved before further mutation.
Ambiguous acceptance retains reservations until reconciliation. Closing observation
does not interrupt execution; explicit interruption needs acknowledgement.

Terminal execution releases computation capacity. Ownership ends only at accepted
delivery, independently reviewed and validated no-change, or explicit safe release.
Review and checks apply to an exact revision. Repair needs fresh evidence. Preparation
can survive an unrelated main update while preserving its original validation facts.

Provider, source observations, independent review, validation and delivery are
injected runtime policy. A local Codex transport proves nothing about modern hosted
Cloud. Never bypass protections or treat worker-authored direction as authorization.
