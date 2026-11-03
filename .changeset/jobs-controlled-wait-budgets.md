---
"@shivaedev/jobs": minor
---

### Breaking

- Testing controller wait budgets now use the caller's Effect clock. Stories on TestClock must fork waits and advance their clock to test a timeout; applications using the default clock keep wall-time budgets.
