# Work Fleet north star

Give it an approved batch and clear authority. It keeps useful work moving,
survives interruptions, and brings the human concrete decisions.

Work Fleet is for a maintainer who already knows which repository changes are
worth doing. A batch supplies the desired result, instructions, checkout, allowed
paths, checks and delivery condition. The application carries that finite batch
through a worker, independent review, repair and delivery.

Success means completed outcomes with little coordination: eligible work fills
available capacity, a blocked item does not stop unrelated items, repairs return
to the original worker, and the human sees a specific question with context and
a recommendation. An idle process or a finished agent turn is not success.

The small installation is one local coordinator, SQLite, the installed coding
agent and GitHub tools. Markdown provides three read-only views: Active,
Completed and Needs human. The CLI and an Effect service provide the control
surface.

## Boundaries

- The human chooses the batch and grants execution and merge authority.
- Agents supply code and judgment. Software owns admission, evidence matching,
  reconciliation and delivery conditions.
- The application coordinates prepared, isolated checkouts. It does not own a
  general planning system, agent hierarchy, desktop shell or deployment platform.
- Provider uncertainty remains visible. An unknown acknowledgement never means
  permission to launch replacement work.
- This is a local trust boundary, not multi-user authorization or a sandbox for
  running untrusted repositories.

The [roadmap](./roadmap.md) separates the implemented boundary from the work still
needed to reduce operator attention.
