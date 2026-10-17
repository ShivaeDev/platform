### Added

- `domNavigate(url?: string | URL): Promise<Response>` follows document redirects, keeps cookies and loads the final HTML for DOM stories, including social sign-in through an outbound OAuth fake.

### Fixed

- Keep Node fetch for in-process hosts and route the DOM document's asynchronous HTTP requests through the same outbound fakes. Unrouted external hosts fail DOM stories with the hostname, even when application code catches the request error.
- Pass the `domFetch` result explicitly to browser clients (for Better Auth, `fetchOptions.customFetchImpl`); global fetch now belongs to the host. Happy-dom remains an optional peer for the DOM environment.
