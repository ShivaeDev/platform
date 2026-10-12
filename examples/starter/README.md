# @shivaedev/starter

A small notes app showing Platform's path from a migrated PostgreSQL table through RPC to a React form. Copy the folder to start your own application.

```tsx
const query = useQuery(client.api.list.query());
```

The route loader and screen share the same native query registry. Creating a note saves it in PostgreSQL and refreshes the list.

## Run or copy it

Follow the [quickstart](https://github.com/ShivaeDev/platform/blob/main/docs/framework/quickstart.md). In this repository, run `./script/update` at the root, copy `.env.example` to `.env.local` here, then run `pnpm dev`. Open `http://127.0.0.1:5173`.

The app uses Tailwind's neutral shadcn theme and application-owned `Button` and `Input` components. Server entry points are in `src/server`; the shared contract is `src/notes.ts`; the browser starts in `src/client/entry.tsx`.

`pnpm build && pnpm start` serves the built UI and HTTP/NDJSON RPC together at `http://127.0.0.1:3000`. Set `DATABASE_URL` in `.env.local` or the shell. For hosting behind a proxy, follow the quickstart's [Deploy section](https://github.com/ShivaeDev/platform/blob/main/docs/framework/quickstart.md#deploy).

`pnpm test` runs the React test and the PostgreSQL/HTTP round trip. Set `TEST_DATABASE_URL` to a dedicated PostgreSQL database whose role can create databases; the test creates disposable clones. Repository test runs supply `PLATFORM_EFFECT_SQL_TEST_DATABASE_URL` instead. Missing database configuration fails the test.
