### Fixed

- Workers and reviewers accept green checks on the exact branch head while the merge queue validates against latest main. PR adoption tolerates main advancing with unchanged head and changed paths, and reviewed, conflict-free work behind main waits for human delivery without repeating review or validation.
