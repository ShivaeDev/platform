---
"@shivaedev/work-board": patch
---

### Changed

- The phone navigation's Today tab shows the same needs-you count as the sidebar, as a badge, and names it for screen readers, such as "Today, 4 need you".
- The sidebar, top bar and phone tab share one needs-you badge, in the needs-you colour when the count is above zero.
- The sidebar leaves out Active goals while Today is open, because Today already lists them.

### Fixed

- On phones, the header says when updates are paused, a refresh failed or the connection is reconnecting, with an icon and a short word that screen readers announce. It stays empty while nothing is wrong.
