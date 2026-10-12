### Fixed

- Retrying a PR conflict decision, with or without response text, sends the existing PR to its worker to merge main and push before another review.
- Retrying a repair rejected at the Codex active-turn resubmission limit starts a fresh thread for the same branch and PR, retaining that intent across restart.
