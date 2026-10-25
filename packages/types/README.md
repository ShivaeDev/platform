# @shivaedev/types

Shared type helpers for the places where Platform packages need the same TypeScript rule. `Bivariant` lets a function property hold a callback with a narrower input type while keeping its return type checked.

## Why you want this

A registry or implementation boundary may need one callback shape even though each callback accepts its own input type. Making every function member a method hides that choice. `Bivariant` puts it on the property that needs it:

```ts
import type { Bivariant } from "@shivaedev/types/Bivariant.ts";

function handleName(name: string): number {
  return name.length;
}

export const handler: { readonly handle: Bivariant<(value: unknown) => number> } = {
  handle: handleName,
};
```

The property accepts the string callback under a shared `unknown` input shape. Its expected result is still `number`. The exception is visible in the type, so a reviewer can find where callback parameter checking changes.

## Using it

### How to think about callback assignment

A callback has an input type and a result type. With TypeScript's strict function checks, a property typed `(value: unknown) => number` rejects `handleName`: the property's type allows a caller to pass any value, but `handleName` accepts only strings.

TypeScript uses a looser parameter assignment check for methods, called **bivariance**. It allows the narrower string parameter in this assignment. `Bivariant<Fn>` gives a function property that method-style check. It does not remove the return-type check: a callback returning `number` is still rejected when the property requires `string`.

Separate two jobs when choosing the type:

1. **Define a callback precisely.** Keep its real input type, such as `string`, so its implementation and ordinary callers share the same contract.
2. **Collect or erase callbacks at a boundary.** Use `Bivariant` only on the property whose common shape must accept those narrower callback types. The code that calls it owns the relationship between each callback and its valid input.

Apply the second job when adapting a typed public callback to an implementation that no longer carries its input type. Leave the public callback strict; place `Bivariant` on the erased implementation property that needs it.

### API

`Bivariant<Fn>` from `@shivaedev/types/Bivariant.ts` is a type alias, not a function: import it with `import type`. `Fn` is the function type whose parameter and return types form the property.

### Install and limits

```sh
pnpm add @shivaedev/types
```

Enable `strictFunctionTypes`, usually through `strict`, to retain the ordinary function-property checking shown here.

- A callback assigned under an `unknown` input shape has not become able to handle every value. Keep its valid input paired with it, or validate input in the owning integration before calling it.
- This package supplies no runtime validation.
- Overloads, generic signatures and explicit `this` parameters have no tested contract.
