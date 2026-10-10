# Naming and test layout

A name says what a thing is. The rules below give identifiers, files, folders and tests a common shape, so a reader can find the defining module and recognize test code. For the gate's workflow, see the [README](../README.md).

A name says what a thing is, and the same kind of thing is named the same way everywhere. Every naming rule is an error without an autofix: nothing renames code or adds a `_` prefix. The message says what is wrong and which shapes are valid, and the author picks the name. Unused variables and parameters stay TypeScript errors; remove them instead of prefixing them.

### Identifiers

| What | Valid shape | Checked by |
| --- | --- | --- |
| Variables, functions and parameters | camelCase: `itemCount`, `loadItem`. A component or a class is PascalCase. | `useNamingConvention` |
| Acronyms | Spelled as a word: `HttpClient`, `userId`, `parseUrl`. Never `HTTPClient`, `userID` or `parseURL`. | `useNamingConvention` with `strictCase` |
| Types, interfaces, classes and enums | PascalCase, without an `I` prefix: `Item`, not `IItem`. | `useNamingConvention` |
| Type parameters | `T`, or `T` followed by a PascalCase name: `TItem`, `TResult`. Effect's positional `A`, `E` and `R` are valid as they are. | `useNamingConvention` |
| Module-level constants | A string or number literal at module level is CONSTANT_CASE: `const MAX_ITEMS = 50`. A constant inside a function is camelCase. | `constant-names` plugin, `useNamingConvention` |
| Object keys and type properties | camelCase or PascalCase, after any leading `_` or `$` (`_tag`, `$transaction`), also in a `Record`. A quoted key is a [foreign name](./naming.md#foreign-names) and is not checked. | `key-names` plugin |
| Schemas | PascalCase and named like their type: `const Item = Schema.Struct(...)` with `type Item = typeof Item.Type`. | `schema-names` plugin |
| `Schema.Struct` fields | camelCase, also when quoted. Outside data keeps its keys only at the edge: `Schema.Struct({ createdAt: Schema.String }).pipe(Schema.encodeKeys({ createdAt: "created_at" }))`. | `schema-struct-keys` plugin, `key-names` plugin |
| `Effect.fn` spans | `"Owner.operation"`, where the owner is the service or module and the operation is the name the function is bound to: `const loadItem = Effect.fn("ItemStore.loadItem")`, and `loadItem: Effect.fn("ItemStore.loadItem")` in an object. | `effect-fn-spans` plugin |
| `Effect.gen` functions | A top-level function whose whole body is `Effect.gen` is an `Effect.fn`: `const loadItem = Effect.fn("ItemStore.loadItem")(function* (id: string) { … })`, or `Effect.fnUntraced` when it needs no span. | `effect-fn-functions` plugin |
| Effect test bodies | In test code, a test takes the generator itself: `it.effect("loads the item", function* () { … })`, never `() => Effect.gen(function* () { … })`. The test helper runs it with `Effect.gen`. | `effect-test-bodies` plugin |
| Service Layers | A static `layer` on the service, read as `ItemStore.layer`. No exported `ItemStoreLive` or `ItemStoreLayer` constant. A Layer that wires an application together stays unexported. | `service-layers` plugin |
| Private members | A `#field`. No `private`, `protected` or `public` modifier. | `useConsistentMemberAccessibility` |
| React | A function passed to an `onX` prop is `handleX`, an `onX` prop forwarded as it is, or a state setter passed as it is: `onOpenChange={setOpen}`. A context is `ThemeContext`, a ref `inputRef`, an id `fieldId`. A module that exports a component exports only components; a test may define the components it renders. | `handler-names` plugin, `useReactNamingConvention`, `useComponentExportOnlyModules` |
| Booleans | A question: `isOpen`, `hasSave`, `canRetry`, `shouldFlush`. A name the DOM or React gives, such as `open` or `disabled`, stays. This is a convention only; no rule checks it. | Review |

### Foreign names

Some names are not ours to choose: a query parameter an outside API reads, an environment variable, an operator a query builder takes. Write such a name as a quoted key, and the naming rules skip it:

```ts
const query = { "per_page": 50, "sort_by": "created" };
const env = { "DATABASE_URL": url };
const where = { "OR": [{ id }, { slug }] };
```

An unquoted key is our own name and is camelCase or PascalCase. The formatter keeps the quotes as written, so a quoted key stays quoted. A `Schema.Struct` field is the exception: the struct is our model of the data, so the `schema-struct-keys` plugin reports a snake_case field even when it is quoted, and points to `Schema.encodeKeys`, which maps camelCase fields to the outside names at the edge.

### Re-exports

No file re-exports, package entry files included: every module is imported from the file that defines it. `noBarrelFile` reports `export { … } from`, `noReExportAll` reports `export *`, the `type-re-exports` plugin reports `export type … from`, and `noExportedImports` reports an import that is exported again. Its message suggests `export … from`, which is a re-export as well: import the name where it is used instead.

The plugins report under the one Biome category `plugin`, so their findings share the baseline rule `biome/plugin`.

### Files

`files/named-after-export` names a code file after its main export, and the folders above it are the prefix. The export takes the words of the file name, in order, and may add words of its folders around them, in any order and in singular or plural. Folders count from the package root, without a leading `src`; the package name does not count. The file's first letter follows the export's case.

| File | Exports | Valid |
| --- | --- | --- |
| `routers/items/list.ts` | `listItems` or `itemList` | Yes |
| `routers/items/Create.ts` | `CreateItemRouter` | Yes |
| `item/Panel.tsx` or `ItemPanel.tsx` | `ItemPanel`, with `ItemPanelProps` beside it | Yes |
| `Panel/Panel.tsx` | `Panel`: the main file of a module folder repeats the folder | Yes |
| `limits.ts` | `MAX_ITEMS` and `MAX_DEPTH`: a topic file of several exports is camelCase | Yes |
| `ItemPanel.tsx` | `export default memo(ItemPanel)`: a default export counts under the name it resolves to | Yes |
| `setupTests.ts` | Nothing, so it is camelCase | Yes |
| `script/build-docs.ts` | Run by a `package.json` script or `bin`, or starts with `#!`, so it is kebab-case | Yes |
| `order.ts` | `type Order` | No: the file's case follows the export, so it is `Order.ts` |
| `maxItems.ts` | `MAX_ITEMS` alone | No: constants live in a topic file with related constants |
| `items/listItems.ts` | `listItems` | No: the folder is the prefix, so it is `items/list.ts` |

Test files are left to the test rules. The `toolOwned` option lists `.gitignore` patterns of files whose names a tool fixes, `*.config.*` and declaration files by default.

### Folders

`files/folder-names` checks every folder above a checked file.

- A module folder takes the name of its main file, inside it or beside it: `Panel/` with `Panel/Panel.tsx`, or `Dialog/` beside `Dialog.tsx`. A PascalCase folder without that file is a finding.
- A package folder is its package name without the scope, so `@acme/ui-kit` lives in `ui-kit/`.
- A folder that only groups files is kebab-case: `test-support/`, `.github/`.
- A folder the `content` option lists is snake_case: `forest_path/`.

The `toolOwned` option lists folders a tool names, `generated/` and `migrations/` by default.

### Other files

`files/other-names` names the files that are not code.

- Markdown, JSON, GritQL, images, fonts and SVG are kebab-case, with optional dotted parts: `release-notes.md`, `icons.sprite.svg`. Conventional upper-case names stay: `README.md`, `CHANGELOG.md`, `LICENSE`, `AGENTS.md`, `CLAUDE.md`, `CONTRIBUTING.md`, `SECURITY.md` and `SKILL.md`.
- A stylesheet that one component imports is named after it: `ItemPanel.css` beside `ItemPanel.tsx`. A shared stylesheet is kebab-case: `form-controls.css`. An import is a static `import` in a code file, relative or through a `#` alias from the `imports` of its `package.json`, or an `@import` in a stylesheet; a stylesheet that another stylesheet imports is shared. A path in a string, such as a test that reads the file, is not an import.
- A Prisma schema is camelCase: `schema.prisma`.
- A file the `content` option lists is snake_case: `forest_path.json`. A double underscore separates the parts of an id: `forest_path__clearing.json`.

The `toolOwned` option lists files a tool names: dotfiles, `package.json`, `tsconfig*.json`, `biome.json`, `*.config.*`, `migrations/` and `generated/` by default.

### Tests

A test sits beside the code it covers, and its name says what it covers and where it runs.

| File | Covers | Valid |
| --- | --- | --- |
| `cart/cart.test.ts` | `cart/cart.ts` | Yes |
| `cart/cart.typecheck.test.ts` | The types of `cart/cart.ts`, checked by the compiler | Yes |
| `cart/Basket.dom.test.tsx` | `cart/Basket.tsx`, in a DOM | Yes |
| `cart/checkoutFlow.spec.ts` | A behaviour of the `cart/` folder as a whole, such as a flow across several files | Yes |
| `cart/checkoutFlow.dom.spec.tsx` | The same, in a DOM | Yes |
| `cart/checkoutFlow.typecheck.spec.ts` | The types of that behaviour, checked by the compiler | Yes |
| `cart/totals.test.ts` | No `cart/totals.ts` beside it | No: a `.test` follows a file, and a test of the folder is a `.spec` |
| `cart/cart.spec.ts` | | No: a `.spec` names a behaviour, so it may not share a stem with a file beside it |
| `cart/cart.hydration.test.ts` | | No: an aspect gets its own file in the module's folder, or a `.spec` |
| `cart/cart.postgres.test.ts` | | No: a database or a running app comes from the app's test fixture, not a file name |
| `test/cart.test.ts` | | No: a test folder mirrors the source tree; the test sits beside `cart.ts` |

`tests/follow` checks the name: `<file>[.<environment>].test.ts` beside its file, or `<behaviour>[.<environment>].spec.ts` in camelCase in the folder it covers. The environment is at most one of `dom`, `slow` and `typecheck`; [Vitest projects](./tooling.md#vitest-projects) run the runtime tests, and the compiler checks `.typecheck` files. For runtime tests, the rule requires `.dom` when it sees a static `@testing-library/*` import or dotted `document`/`window` member access. It does not track aliases, destructuring or computed access.

`tests/colocated` checks the place: a test in a `test`, `tests`, `__tests__` or `spec` folder is a finding.

Both rules take a `suites` option, `.gitignore` patterns of folders that hold tests with their own layout, such as tests across several packages or a Playwright suite, whose `.spec.ts` files mean something else. The rules skip those folders.

### Test code

Test code is a test file (`*.test.ts` or `*.spec.ts`, with any environment), or any file under a folder named `test-support/`. `test-support/` is the folder for fixtures, harnesses and generated clients that tests share. `imports/fences` never holds test code, and `structure/max-lines` gives it the test limit.

Name shared helpers without a `.test` or `.spec` suffix. `tests/follow` and `tests/colocated` use those suffixes to identify test files; the folder name alone does not make them skip a test-named file. `tests/story-setup` skips every file under `test-support/`, including a test-named file there.

### Story tests

Keep recurring setup in a domain kit under `test-support/`; the [test-story README](https://github.com/ShivaeDev/platform/tree/main/packages/test-story#readme) explains traits, verbs and a kit's `it`. Quality checks the setup patterns below; it does not establish which engine a test runs.

`tests/story-setup` reports, in a test file:

- A top-level function whose name starts with the word `seed`, `make`, `build` or `setup`, declared as a function or a variable holding an arrow function or function expression. The prefix is a whole word, so `builder` and `settings` pass. Nested helpers and declarations without a body are outside this check.
- A call that writes fixture files through Node's `fs` or `fs/promises`: `writeFile`, `appendFile`, `mkdir`, `mkdtemp`, `copyFile`, `cp` and `symlink`, including their sync forms. Named, renamed, namespace, default and `promises` imports are checked.

Each finding names its line and uses the helper or called function as its subject. The message asks for setup as traits of the kit and links to the README's story-test guidance. The rule reports without rewriting a test. Record existing findings with `quality baseline write --rule tests/story-setup` when adopting it.
