---
"@shivaedev/http": minor
---

### Fixed

- Remove userinfo, query strings and fragments from status-error URLs.
- Keep pagination links on the request's origin.

### Breaking

- Pagination rejects automatic fetch redirects so custom headers cannot reach another origin. Pass a direct same-origin page URL instead of a redirecting URL; links to later pages must also use direct URLs. Other fetch options in the current Effect context are preserved. Use a client without redirect-following middleware.
