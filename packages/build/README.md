# @shivaedev/build

An application's build setup. Its generator reads each defined module's `run` types and writes the wire the server encodes with and the browser decodes with, so an operation is written once, as its business logic, and the browser receives exactly what the type says.

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

`generate` finds every file of the project's tsconfig that calls `defineModule`, builds one TypeScript program for them and writes one file per module at `src/generated/<the module file's path under src>`. There is no list of modules to keep. The generated files are not committed, so a project runs `generate` before anything that reads them; a run whose inputs have not changed is cheap. No package or starter script runs it yet.

The generator never guesses. Each type `run` returns maps to the one schema whose `Type` is exactly that type, or the run stops with a refusal that says what to write instead. The compiler then checks the generated wire against `run` on every type check, through [`@shivaedev/contract`'s module checks](https://github.com/ShivaeDev/platform/tree/main/packages/contract#the-wire-and-the-browsers-contract), so a file that went stale is usually a compile error on the module that names the operation, including a success type that gains or loses an optional property at any struct position the check walks. One change is not: an optional property that only one side has on a `Schema.Struct` behind another schema, such as a transformation, a brand or `Schema.suspend`, still type-checks and is dropped on the wire or never sent. `generate --check` is the guard against it.

### Generate the files

Run the command in the folder that holds the project's `tsconfig.json`:

```sh
shivaedev-build generate
shivaedev-build generate --check
```

`generate` writes each file that is missing or differs, and reports every module as `written`, `current` (derived again and equal to the file) or `unchanged, from the cache`. `--check` writes nothing and exits 1 listing each missing or stale file with "run `pnpm generate`". A refusal exits 1 with its message, and the refused module's file is not written. For the same inputs the output is byte for byte the same.

A workspace package can run the generator from source before anything is built:

```sh
node --conditions=@shivaedev/source packages/build/src/cli.ts generate
```

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
| string and number literals and their unions                          | `Schema.Literal`, `Schema.Literals`                                                                                             |
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

Anything else is refused, such as a `Map`, a class that is not a Schema class, a function, `any`, `string | number`, a branded type, `null | undefined` (the wire would turn one into the other), a property typed `T | undefined`, or an optional property typed `T | undefined`:

```text
refused.returnsMap: run returns Map<string, number> at success, which has no exact wire form; return a plain object, an array or a string-keyed record
```

The path after `at` points into the returned value, such as `success.summary`.

### Rejections

An operation's rejections are the tagged failures of its `run` and, for a query, of its read policy, each the exported class it is raised as and imported from the module that declares it. Two classes of the same shape and tag are different rejections: the generated file imports the one `run` raises. A failure that states `isRetryable`, a `SchemaError`, a `QueryReadDenied` and the automatic `InternalServerError` and `ServiceUnavailable` are left out, and nothing adds a `Conflict`. A failure without a `_tag`, or whose class is not exported, is refused:

```text
refused.failsUntagged: run fails with string, which has no _tag; fail with an exported tagged error class instead
```

### Staying current

Each module's inputs are the contents of every project file in its import graph, its tsconfig and the files it extends, the lockfile, which stands in for installed packages, and the generator's own code and TypeScript's version. They are recorded under `node_modules/.cache/@shivaedev/build/`. A run whose inputs are unchanged builds no program and reports the module as unchanged; a generated file removed meanwhile comes back from the cache. Files are written only when their content differs, through a fresh file renamed into place, so a reader never sees half a file.

A run that builds a program takes the machine-wide [heavy lock](https://github.com/ShivaeDev/platform/tree/main/packages/heavy-lock), so it waits while another heavy run holds it; an unchanged run does not.

`ClientMatchesModule` compares payloads, successes and rejections. A changed `invalidates`, `reads` or key scope changes the module's inputs, so `generate --check` reports the file stale and the next `generate` writes the change.

### Limits

- The package is private while its npm setup is pending, and no package of this repository runs it yet.
- It reads types through TypeScript 6's API, while this repository type-checks with TypeScript 7; a disagreement between the two shows as a compile error on the module.
- An invalid `Date` cannot be encoded, so the caller gets `InternalServerError`.
- A module file must lie under `src`, define exactly one module and export it as a const.
