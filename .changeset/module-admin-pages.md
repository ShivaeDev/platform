---
"@shivaedev/admin": minor
"@shivaedev/create-app": minor
---

### Breaking

- `@shivaedev/admin`: Move page declarations and `registerAdmin` handler maps into their owning modules. Combine their registries with `mergeAdminRegistries` in browser composition and their registrations with `mergeAdminRegistrations` in the application host. Registration now exposes its pages; duplicate page ids are rejected by TypeScript as well as at runtime. Keep each module's handler Layer with its page registration.
- `@shivaedev/create-app`: The starter foundation owns Users and Jobs, and notes registers only its statistics page. Move application pages and handlers into their owning module registrations and combine them at the host; client modules contribute navigation through their own registry. Run `create-app update` to merge the starter side, preserving application customizations through its normal merge flow. Minimal apps retain Users and Jobs when notes is removed.
