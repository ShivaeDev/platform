# Shared tooling

Quality ships Biome and TypeScript presets and Vitest project helpers alongside the gate. Use the [README](../README.md) to configure the gate; use this page to wire the tools that check, format, compile and run the repository.

## Biome preset

`@shivaedev/quality/biome` supplies the shared Biome configuration. Quality includes and runs Biome; the root `biome.json` extends the preset and adds the repository's own settings:

```json
{
	"$schema": "./node_modules/@biomejs/biome/configuration_schema.json",
	"extends": ["@shivaedev/quality/biome"]
}
```

The preset sets:

- **Formatting:** tabs, a line width of 150, double quotes, semicolons, trailing commas and operators at the start of a wrapped line. An object key keeps its quotes, because a quoted key marks a [foreign name](./naming.md#foreign-names).
- **Lint:** recommended rules are set to `error` or explained in the preset's declarations. Stricter settings include `noUnsafeTypeAssertion`, `useBlockStatements`, `useNumericSeparators`, `useUnicodeRegex`, `useLiteralKeys`, `noFloatingPromises`, `useExhaustiveDependencies`, `useConsistentTestIt`, `noNonScalableViewport`, function declaration style, interface style, a cognitive complexity limit of 15, `noNestedTernary` and the [naming rules](./naming.md).
- **Imports:** organized in five groups: Node and Bun builtins, packages, `@shivaedev/*` packages, aliases and relative paths. Biome counts as an alias a specifier that starts with `#`, `@/`, `~`, `$` or `%`; a tsconfig path such as `@app/*` sorts with the packages, and Biome's `noUndeclaredDependencies` takes it for one, so name aliases in a form Biome recognizes.
- **Assist:** organized imports and checks for sorted keys, attributes, enum members, interface members and properties. The key-sorting check applies to JSON and object literals, but `quality fix` skips its fix. `package.json` is left out of that check because `manifests/sorted` supplies its key order.
- **Plugins:** GritQL rules that ban ambient time, randomness, `console` and `process.env` for Effect's services, and the naming plugins under [Naming](./naming.md). They load from `./node_modules/@shivaedev/quality/biome/plugins`, so the package must be installed at the repository root.
- Files ignored by git are skipped.

The preset turns off `noUnusedVariables` and `noUnusedFunctionParameters`, because the tsconfig presets report them through TypeScript. It allows default exports in `*.config.*` files, which tools load through the default export, and turns off `useComponentExportOnlyModules` in `*.test.*` and `*.spec.*` files, where tests define their harness components.

The preset also sets `noProcessGlobal`, `useJsonImportAttributes`, `noMisusedPromises`, `useExhaustiveSwitchCases`, `useSortedClasses`, `noDelete`, `useConsistentArrayType`, `useConsistentCurlyBraces`, `noEqualsToNull` and `noSkippedTests` to `off`. Their declarations reserve changes that need author review or keep interacting fix rounds from continuing indefinitely. `noUndeclaredClasses` is off because its class resolution does not cover aliases and Tailwind utilities; `noInlineStyles` is off because computed values need inline styles. These exceptions have reasons in the shipped `declarations.json`; additional weakenings need the repository's own declarations.

The preset keeps the following rules at `error` with their fixes off so the author decides the repair: `noAccessKey`, `noAriaHiddenOnFocusable`, `noAutofocus`, `noInteractiveElementToNoninteractiveRole`, `noNoninteractiveElementToInteractiveRole`, `noNoninteractiveTabindex`, `noRedundantRoles`, `useValidAriaProps`, `useValidAriaRole`, `noImportantStyles`, `noConstAssign`, `noUnusedPrivateClassMembers`, `useExhaustiveDependencies`, `noFloatingPromises`, `useConsistentTestIt`, `useRegexpTest`, `useUnicodeRegex`, `noNonNullAssertion`, `useAtIndex`, `noParametersOnlyUsedInRecursion` and `useNamingConvention`. The fix command also skips `noDuplicateObjectKeys` and `useSortedKeys`.

The `biome` rule runs `biome check` with the repository's config and reports each finding as `biome/<category>`, such as `biome/lint/style/useBlockStatements`, `biome/assist/source/useSortedKeys`, `biome/format` or `biome/plugin`, so Biome's findings go through the baseline like any other rule's. `quality baseline write --rule biome` takes in every Biome category at once. A finding below `error`, such as a rule a repository declared at `warn`, is not reported. The rule also asks for a root `biome.json` or `biome.jsonc` that extends the preset, and it takes no registry exceptions. A Biome config that Biome cannot load stops the run with Biome's message.

`quality fix` sorts the discovered manifests, then runs `biome check --write --unsafe`, with the two skipped fixes above. It then runs Biome's formatter, because a lint fix can leave code unformatted. One fix can make room for another, so it repeats both passes until a round rewrites nothing, at most five rounds. When files still change in the fifth round, it names the changed text files it can discover and exits 2; when those files are outside its inventory, the error gives a verbose Biome command to name them. An unsafe fix can change behavior, such as `==` becoming `===`, so review what it changed.

## Vitest projects

`@shivaedev/quality/vitest.ts` sets up the tests of a package by file name, so no test file sets its environment with a pragma. It needs `vitest`, and `happy-dom` for DOM tests. A package's `vitest.config.ts` reads:

```ts
import { testProjects } from "@shivaedev/quality/vitest.ts";
import { defineConfig } from "vitest/config";

export default defineConfig({ test: testProjects() });
```

| Project | Files | Environment | Runs |
| --- | --- | --- | --- |
| `unit` | `*.test.ts`, `*.spec.ts` and the other test and spec files | Node | By default |
| `dom` | `*.dom.test.tsx`, `*.dom.spec.tsx` and the other `.dom` files | happy-dom | By default |
| `slow` | `*.slow.test.ts`, `*.slow.spec.ts` and the other `.slow` files | Node | Only with `vitest run --project slow` |

Type tests (`*.typecheck.test.ts`, `*.typecheck.spec.ts` and `typecheck.test.ts`) are in no project: the compiler checks them. A test that is too slow for every run goes into the slow project instead of being skipped.

A folder that another runner owns, such as a Playwright suite of `.spec.ts` files, is left out with `testProjects({ exclude: ["e2e/**"] })`; the globs are added to every project's `exclude`.

### Inherited tags

Vitest gives an inline project only the [tags](https://vitest.dev/guide/test-tags) it declares itself, never those of a config file it `extends`. A test tagged in that file then fails with `cannot apply "<tag>" tag for this test` as soon as a root config runs it. A root config that gathers the projects of several packages, or whose projects extend a shared base config, passes them through `inheritTags`:

```ts
import { inheritTags } from "@shivaedev/quality/vitest.ts";
import { defineConfig } from "vitest/config";

const bakery = { extends: "./packages/bakery/vitest.config.ts", root: "./packages/bakery", test: { name: "bakery" } };

export default defineConfig(async () => ({ test: { projects: await inheritTags([bakery], import.meta.dirname) } }));
```

`inheritTags(projects, root)` loads the config file of each inline project whose `extends` is a path, resolved against `root`, and adds the tags that file declares to the project's own, so `vitest run --tags-filter=<tag>` works across the workspace. A tag the project declares itself wins over an inherited one of the same name. Config objects and config functions are supported. A project that extends `true`, and a glob or file path, comes back unchanged. The extended files load with Node's own `import`, so each must be a module Node runs without a bundler.

## tsconfig presets

Two presets supply a shared strict TypeScript setup for type-checking and package builds.

| Preset | Use |
| --- | --- |
| `@shivaedev/quality/tsconfig/base.json` | Type-checking with `noEmit`: applications, tests and scripts. |
| `@shivaedev/quality/tsconfig/package.json` | Building a package: the base plus `declaration`, `declarationMap`, `sourceMap` and `rewriteRelativeImportExtensions`, so relative `.ts` imports are emitted as `.js`. |

```json
{
	"extends": "@shivaedev/quality/tsconfig/base.json",
	"compilerOptions": {
		"lib": ["ESNext", "DOM"],
		"types": ["node"]
	},
	"include": ["src"]
}
```

The base sets:

- **Language:** `target` and `lib` are `ESNext`.
- **Modules:** `module` ESNext, `moduleResolution` bundler, `moduleDetection` force, `verbatimModuleSyntax`, `isolatedModules`, `allowImportingTsExtensions`, `resolveJsonModule`, `noUncheckedSideEffectImports`, `forceConsistentCasingInFileNames` and `libReplacement: false`.
- **JavaScript:** `allowJs` and `checkJs`, so JavaScript files are type-checked with the TypeScript ones.
- **Erasable syntax only:** `erasableSyntaxOnly` rejects syntax that type stripping cannot erase, such as parameter properties.
- **Checks:** `strict`, with `noImplicitAny`, `strictBuiltinIteratorReturn` and `useUnknownInCatchVariables` stated explicitly, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noImplicitReturns`, `noFallthroughCasesInSwitch`, `noUnusedLocals`, `noUnusedParameters`, `allowUnreachableCode: false` and `allowUnusedLabels: false`.
- **Compiler settings:** `stableTypeOrdering` and `skipLibCheck`.

`noPropertyAccessFromIndexSignature` stays off, so a map-like key is read with dot access, and `isolatedDeclarations` stays off, so exported values keep their inferred types. `types`, `jsx`, `paths`, `include` and the output directories belong to each project. A project that needs more built-ins, such as the DOM, sets `lib` itself and keeps `ESNext` in it.

A package that type-checks its tests with one config and builds `src` with another extends both, the package preset last:

```json
{
	"extends": ["./tsconfig.json", "@shivaedev/quality/tsconfig/package.json"],
	"compilerOptions": { "outDir": "dist", "rootDir": "src" },
	"include": ["src"]
}
```
