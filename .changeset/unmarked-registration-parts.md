---
"@shivaedev/build": minor
---

### Breaking

- `generate` refuses an exported object under a `server` folder that carries a registration part, such as `export const usage = { admin }` or `{ queues, workers }`, and is not written `satisfies AppModule`, with a message naming the file, the export and the part. Before, such a registration outside a module's `server/registration.ts` was left out of the server's module list without a word, so its admin page, queue or worker was missing at run time. The parts are read from `AppModule`'s own type in the installed `@shivaedev/server`. A build that passed with such an object now fails. To migrate, write `satisfies AppModule` after the object when it is a registration; when it is not, rename its key or stop exporting it.
