---
"@shivaedev/create-app": patch
---

### Fixed

- Generated resource stories use a controlled clock seeded at the current date so minted sessions remain valid for Better Auth. Generator and starter-update stories also use the controlled clock and observe child-process completion.
