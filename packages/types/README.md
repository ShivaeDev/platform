# `@shivaedev/types`

Type-only helpers shared by the ShivaeDev packages. The package ships no runtime code and has no dependencies.

## Install

```sh
pnpm add @shivaedev/types
```

## `Bivariant`

TypeScript checks the parameters of a function property strictly, so a property typed `(value: unknown) => void` rejects a function that takes only a `string`. A method signature checks them bivariantly and accepts it. `Bivariant<Fn>` gives a property the method's check, for a member that must hold functions with different parameter types, such as a list of rules with different options.

```ts
import type { Bivariant } from "@shivaedev/types";

interface Rule {
	readonly configure: Bivariant<(options: unknown) => void>;
}

const rules: readonly Rule[] = [{ configure: (options: { readonly max: number }) => {} }];
```

The return type stays covariant. Use it only where the caller cannot know each function's parameter type and checks its input at runtime; elsewhere, a property with an exact parameter type is safer.
