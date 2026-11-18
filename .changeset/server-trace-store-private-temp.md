---
"@shivaedev/server": patch
---

### Fixed

- The development trace store that a working directory without `node_modules` gets in the system's temporary directory is now in a folder only its user can reach. The folder is `shivaedev-server-<user id>-<hash of the working directory>`, created with owner-only permissions, so its path changes once from the earlier `shivaedev-server-<hash>` and then stays the same across restarts. When that name is held by a link, by another user's folder or by a folder open to others, the host records in a newly made private folder and the startup log line names it. Before, another user of a shared temporary directory could make the folder or a link first and read or redirect the traces.
