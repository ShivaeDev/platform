### Fixed

- Review refresh retains the preceding worker receipt when a follow-up fails without a receipt, including archived continuation cycles. PostgreSQL regressions cover retry, fresh review and observed delivery after a completed repair.
- Codex follow-up submissions wait for an active thread turn to finish and continue the same attempt, with polling delays doubling from two to thirty seconds. A five-minute deadline and three-resubmission cap route persistent rejection to a human decision and release execution capacity. PostgreSQL regressions with a synthetic provider cover continuation and deadline recovery; a wire-protocol regression covers the resubmission cap.
