# @shivaedev/build

An application's build setup: one import for its Vite configuration and one for its Vitest configuration. Its generator reads each defined module's `run` types and writes the wire the server encodes with and the browser decodes with, so an operation is written once, as its business logic, and the browser receives exactly what the type says. Its Vite plugin and Vitest setup run the generator wherever the files are read, and a build whose browser bundle reaches server code fails.

## Why you want this

An operation written as `payload` and `*run` has its success and rejections only as types, and types are erased. Without a generator, an application restates them as schemas by hand, and the copy drifts. With it, the module passes the generated wire and the browser imports the generated contract:

```ts
import { defineModule } from "@shivaedev/contract/defineModule.ts";
import { notesWire } from "#generated/modules/notes/notes.ts";
import { Create } from "#modules/notes/create.ts";
import { List } from "#modules/notes/list.ts";
import { NotesStore } from "#modules/notes/store.ts";

export const Notes = defineModule({ name: "notes", operations: [List, Create], requires: [NotesStore], wire: notesWire });
```

```sh
shivaedev-build generate
```

```text
src/generated/modules/notes/notes.ts: written
```

## Using it

### How to think about it

`generate` finds every file of the project's tsconfig that calls `defineModule`, builds one TypeScript program for them and writes one file per module at `src/generated/<the module file's path under src>`. There is no list of modules to keep. The generated files are not committed, so a project runs `generate` before anything that reads them; a run whose inputs have not changed is cheap. Inside Vite and Vitest the plugin and the global setup run it; the command line covers everything else, such as a type check.

The generator never guesses. Each type `run` returns maps to the one schema whose `Type` is exactly that type, or the run stops with a refusal that says what to write instead. The compiler then checks the generated wire against `run` on every type check, through [`@shivaedev/contract`'s module checks](https://github.com/ShivaeDev/platform/tree/main/packages/contract#the-wire-and-the-browsers-contract), so a file that went stale is usually a compile error on the module that names the operation, including a success type that gains or loses an optional property at any struct position the check walks. One change is not: an optional property that only one side has on a `Schema.Struct` behind another schema, such as a transformation, a brand or `Schema.suspend`, still type-checks and is dropped on the wire or never sent. `generate --check` is the guard against it.

### Set up an application

An application's `vite.config.ts` and `vitest.config.ts` each import one function and pass only what is the application's own, such as its Vite plugins and the host routes its dev server forwards:

```ts
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { appViteConfig } from "@shivaedev/build/adapters/appViteConfig.ts";

export default appViteConfig([tailwindcss(), react()], [], ["/health"]);
```

```ts
import { appTestConfig } from "@shivaedev/build/adapters/appTestConfig.ts";

export default appTestConfig();
```

`appViteConfig` adds the generator's Vite plugin and the bundle check to the application's plugins, so `vite build` and the dev server generate first and a browser bundle that reaches server code fails the build. The dev server listens on `127.0.0.1` at the port in `VITE_PORT`, then 5173, and forwards `/api/auth`, `/rpc` and every path in the third argument to the application host on `127.0.0.1` at the port in `PORT`, then 3000, keeping the Host header the browser sent. The fourth argument overrides either port, as in `{ webPort: 5273, apiPort: 3100 }`, and names the packages the bundle check treats as server-only, as in `{ serverOnly: ["pg-boss"] }`. Path resolution follows the tsconfig.

`appTestConfig` builds on Quality's [`testProjects`](https://github.com/ShivaeDev/platform/tree/main/packages/quality#readme), resolves imports for the browser and for the server, inlines the `@shivaedev` packages for the test server and generates as Vitest's global setup, before any test file loads. Its second argument goes to `testProjects`, so `appTestConfig([], { connectionBudget: 84, connectionsPerWorker: 14 })` or `appTestConfig([], { maxWorkers: 4 })` sizes the test workers. The second argument of `appViteConfig` and the first of `appTestConfig` add export conditions for development inside a workspace, such as `["@shivaedev/source"]`; a published application passes none.

An application whose browser still imports contracts or operation files of the old operation form passes `{ bundleCheck: false }` in the fourth argument of `appViteConfig`, and its build then generates without checking the bundle. The option is temporary: it exists for applications still on the old operation form and goes away with that form.

The application's `package.json` runs the generator before anything that reads the files without Vite, and `prepare` makes `pnpm install` write them in a fresh checkout:

```json
{
	"scripts": {
		"generate": "shivaedev-build generate",
		"prepare": "pnpm generate",
		"typecheck": "pnpm generate && tsc --noEmit"
	}
}
```

pnpm does not run `prepare` on a production install (`pnpm install --prod`), so a production install without development dependencies succeeds without the generator; the files must already be written, as `pnpm build` writes them through the Vite plugin. The folder's contents stay out of Git except a README that names the command, and Quality's `imports/resolvable` lists the folder as `generated`:

```gitignore
src/generated/*
!src/generated/README.md
```

### Generate the files

Run the command in the folder that holds the project's `tsconfig.json`:

```sh
shivaedev-build generate
shivaedev-build generate --check
```

`generate` writes each file that is missing or differs, and reports every module as `written`, `current` (derived again and equal to the file) or `unchanged, from the cache`. A generated file whose first line names a module file that is gone or no longer defines a module, because it was renamed or deleted, is removed and reported as `removed`; a file under `src/generated` that the generator did not write is left alone. `--check` writes nothing and exits 1 listing each missing, stale or orphaned file with "run `pnpm generate`". A refusal exits 1 with its message, and the refused module's file is not written. For the same inputs the output is byte for byte the same.

A workspace package can run the generator from source before anything is built:

```sh
node --conditions=@shivaedev/source packages/build/src/cli.ts generate
```

### Generate inside Vite and Vitest

The dev server, the build and the tests read the generated files through Vite, so the plugin and the global setup generate before they do:

```ts
import { buildPlugin } from "@shivaedev/build/adapters/vitePlugin.ts";

export default {
	plugins: [buildPlugin({ serverOnly: ["pg-boss"] })],
	test: { globalSetup: ["@shivaedev/build/adapters/vitest/setup.ts"] },
};
```

`buildPlugin` generates when `vite build` or the dev server starts, in the folder Vite runs in. A refusal stops the build, or keeps the dev server from starting, with the generator's message. While the dev server runs, a change to a file that went into any module's last run, such as an operation's `run`, generates again: each rewritten file's importers are invalidated in Vite's module graph and the browser reloads. A file under `src` that calls `defineModule` and no run has read yet, such as a module file created while the dev server runs, generates too, and when the run writes a generated file that did not exist the browser reloads, so a page that failed to resolve its `#generated/...` import loads without a restart. A refusal then prints the generator's message in the terminal and shows it in the browser's error overlay, and the module's last file stays in place until the next run succeeds.

The global setup generates once before Vitest loads any test file, and a refusal stops the run before a test starts. Runs that start at once, such as two Vitest processes on one project, each generate and leave the files correct, because every file is written whole through a rename.

### Server code in the browser bundle

With a generated client the browser never needs a module or its operations, so the plugin fails a client build whose module graph holds server code. It reads the bundler's module graph, from each client entry, and stops at the nearest module that is:

- a module file, one that imports `defineModule` from `@shivaedev/contract/defineModule.ts`;
- an operation file, one that imports `query` or `command` from `@shivaedev/contract/operation.ts`;
- a file under a `server/` folder;
- a Node builtin;
- `effect/sql`, imported from outside Effect (Effect's own index re-exports modules that import it, which do not count);
- part of a package listed in `serverOnly`.

The build fails with the import chain from the client entry to that module:

```text
Server code reached the browser bundle: src/modules/notes/notes.ts is a module file: it calls defineModule. The import chain from the client entry:
  index.html
  → src/client.ts
  → src/screens/notes.ts
  → src/modules/notes/notes.ts
The browser reaches a defined module through its generated client in src/generated and imports no server code.
```

The browser imports `Notes` from `#generated/modules/notes/notes.ts` instead.

### The generated file

For the module above, the file starts with a line saying it is generated from `src/modules/notes/notes.ts`, must not be edited and is not committed. It exports the module's wire, named after the module's `name`, the browser's contract under the module's own export name, built by `clientContract`, and a closing `ClientMatchesModule` assertion:

```ts
export const notesWire = {
	create: { rejections: { TitleTaken }, success: NoteCard },
	list: { rejections: { Unauthorized }, success: Schema.Array(Schema.Struct({ id: Schema.Number, title: Schema.String })) },
} as const;

export const Notes = clientContract({
	commands: {
		create: { invalidates: () => [notes.list] },
	},
	name: "notes",
	payloads: {
		create: NoteFields,
	},
	queries: {
		list: { reads: () => [notes.list] },
	},
	wire: notesWire,
});

export const notesMatchModule: ClientMatchesModule<typeof Notes, typeof NotesModule> = true;
```

Payloads, `reads`, `readsCollections`, `invalidates` and the module's `middleware`, `subject` and `keyScope` are copied as written, with the imports they use. Two imports that share a name get distinct local names, so a `NoteMissing` from one file and a `NoteMissing` from another both fit. A value declared in the operation's own file, or imported there by a relative path, is refused, because the generated file cannot import it: move it to a module the operation imports through a package import such as `#modules/notes/model.ts`.

### What `run` may return

| `run` returns                                                        | The wire carries                                                                                                                |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `string`, `number`, `boolean`, `bigint`, `null`, `undefined`, `void` | `Schema.String`, `Schema.Number`, `Schema.Boolean`, `Schema.BigInt`, `Schema.Null`, `Schema.Undefined`, `Schema.Void`           |
| string, number and boolean literals and their unions                 | `Schema.Literal`, `Schema.Literals`                                                                                             |
| `T[]` and `readonly T[]`                                             | `Schema.Array`, wrapped in `Schema.mutable` when mutable                                                                        |
| tuples of required elements, readonly or mutable                     | `Schema.Tuple`, wrapped in `Schema.mutable` when mutable                                                                        |
| plain objects, interfaces and type literals                          | `Schema.Struct`, with `Schema.optionalKey` for an optional property and `Schema.mutableKey` for a property that is not readonly |
| string-keyed records                                                 | `Schema.Record(Schema.String, …)`                                                                                               |
| a union of objects told apart by one literal property                | `Schema.Union`                                                                                                                  |
| `T \| null`                                                          | `Schema.NullOr`                                                                                                                 |
| `Date`, `DateTime.Utc`, `Option<T>`                                  | `Schema.Date`, `Schema.DateTimeUtc`, `Schema.Option`                                                                            |
| an instance of an exported Schema class                              | that class, imported from its module                                                                                            |

Effect RPC encodes with `Schema.toCodecJson`, so a `Date` travels as an ISO string and arrives as a `Date`, a `bigint` travels as a string, and `NaN` and the infinities travel as strings. Each of these arrives equal to what `run` returned and of the same class. One value does not: `-0` arrives as `0`, because JSON has no `-0`.

A class instance and a same-shaped interface are told apart by declaration: a helper typed to return an interface with the fields of a Schema class is written as a struct, and an instance of the class as the class.

An optional property is written with `?` under `exactOptionalPropertyTypes`, such as `flag?: boolean` or `reviewedAt?: Date | null`, and an absent key is the only way to leave it out.

Anything else is refused, such as a `Map`, a class that is not a Schema class or not exported, a function, `any`, `string | number`, an enum, a branded type, a type that contains itself, a tuple with optional or rest elements, a record whose keys are not `string`, `null | undefined` (the wire would turn one into the other), a property typed `T | undefined`, or an optional property typed `T | undefined`:

```text
refused.returnsMap: run returns Map<string, number> at success, which has no exact wire form; return a plain object, an array or a string-keyed record
```

The path after `at` points into the returned value, such as `success.summary`.

### Rejections

An operation's rejections are the tagged failures of its `run` and, for a query, of its read policy, each the exported class it is raised as and imported from the module that declares it. Two classes of the same shape and tag are different rejections: the generated file imports the one `run` raises. A failure that states `isRetryable`, a `SchemaError`, a `QueryReadDenied` and the automatic `InternalServerError` and `ServiceUnavailable` are left out, and nothing adds a `Conflict`. Any failure class with an `isRetryable` property is infrastructure and reaches the browser as one of the two automatic failures, so never put `isRetryable` on a rejection the browser should receive. A failure without a `_tag`, whose class is not exported, or whose class is not a Schema class, such as a `Data.TaggedError`, is refused:

```text
refused.failsUntagged: run fails with string, which has no _tag; fail with an exported tagged error class instead
```

### Staying current

Each module's inputs are the contents of every project file in its import graph, its tsconfig and the files it extends, the project's declaration files, which can declare global types, the lockfile, which stands in for installed packages, and the generator's own code and TypeScript's version. They are recorded under `node_modules/.cache/@shivaedev/build/`. A run whose inputs are unchanged builds no program and reports the module as unchanged; a generated file removed meanwhile comes back from the cache. Files are written only when their content differs, through a fresh file renamed into place, so a reader never sees half a file.

A run in the dev server after a save that changes a module's inputs builds a program again, and later programs of one process reuse the declaration files the first one parsed. On a developer laptop, the first run takes about 0.8 s and each regeneration about 0.15 s for this package's fixture notes module of seven operations; for the starter's notes module written as a defined module, nine operations over SQL, identity and rate limiting, the first run takes about 1.4 s and each regeneration about 0.4 s.

A run that builds a program takes the machine-wide [heavy lock](https://github.com/ShivaeDev/platform/tree/main/packages/heavy-lock), so it waits while another heavy run holds it; an unchanged run does not.

`ClientMatchesModule` compares payloads, successes and rejections. A changed `invalidates`, `reads` or key scope changes the module's inputs, so `generate --check` reports the file stale and the next `generate` writes the change.

### Limits

- The plugin and the global setup take Vite's and Vitest's root as the project folder, the one that holds `tsconfig.json`.
- It reads types through TypeScript 6's API, while this repository type-checks with TypeScript 7; a disagreement between the two shows as a compile error on the module.
- An invalid `Date` cannot be encoded, so the caller gets `InternalServerError`.
- A module file must lie under `src`, define exactly one module and export it as a const.
