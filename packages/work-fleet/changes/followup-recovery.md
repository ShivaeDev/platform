### Fixed

- Review refresh retains the preceding worker receipt when a follow-up fails without a receipt, including archived continuation cycles. PostgreSQL regressions cover retry, fresh review and observed delivery after a completed repair.
- Codex follow-up submissions wait for an active thread turn to finish and continue the same attempt instead of requiring human retry. A PostgreSQL regression with a synthetic provider covers waiting and continuation.
