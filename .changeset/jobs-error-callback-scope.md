---
"@shivaedev/jobs": patch
---

### Fixed

- Tie `onError` callbacks to the jobs Layer's lifetime. Closing the Layer interrupts pending callbacks and waits for them to end before release completes; callbacks that finish before shutdown behave as before.
