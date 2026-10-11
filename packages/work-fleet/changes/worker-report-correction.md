### Fixed

- Give malformed completed worker reports one automatic correction turn on the same thread before requiring a human. A guided retry requests a corrected report in a new turn. Persist correction intents before submission and reconcile lost acknowledgements after restart.
