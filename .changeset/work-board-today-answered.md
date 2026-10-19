---
"@shivaedev/work-board": patch
---

### Added

- Today lists recent answers under **Answered**: the item each question is about, when it was answered and what happened since. An answer reads "Waiting on the agent." until its item closes, its question changes or Fleet's receipt settles it. Answers still waiting stay listed at any age; your own settled answers stay for a week. The inbox projection carries them as `recent`.
- The Fleet start command has a Copy button. When the clipboard refuses it, the command is selected so you can copy it yourself. Start, Handoff and closed drafts share the same copy behaviour.

### Changed

- Each Answered row names the item its question is about, then the question's short label, your answer and the outcome on a second line. Two rows that would read the same add the request ID.
- The Fleet start command wraps, so the whole command shows on a phone.
- The sidebar and top bar show no needs-you badge at zero, like the phone's Today tab; screen readers still hear the count.
- Getting started appears on an empty Today only while the workspace has no identified documents; the inbox projection carries this as `identified`.
- The Today button for the `--home` file is named after that document's title instead of "Workspace notes". The breadcrumb root stays "Workspace".
- "How to start Fleet" shows `npx @shivaedev/work-fleet serve <folder> --port <port>` with the Board's folder relative to where it was started, so it runs where work-fleet is a project dependency.
- Plainer words on Today and System: "N marked in progress" instead of "N in progress in task files", no "Task file" badge, "Age unknown" instead of "Age ?", a plain sentence when files can't be read, "Fleet isn't set up for this Board" and System says where Pause updates lives.
