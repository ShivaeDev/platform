# @shivaedev/effect-service

Declare an Effect service's dependencies once. Its Layer initializes private state, binds those dependencies to the public methods, and releases initialization resources when the Layer's scope closes. Methods remain ordinary Effects with their own success and failure types.

```ts
import { Context, Effect, Layer } from "effect";
import { defineService } from "@shivaedev/effect-service/define-service.ts";

class Prefix extends Context.Service<Prefix, string>()("app/Prefix") {}

const Greetings = defineService({
  id: "app/Greetings",
  requires: [Prefix],
  initialize: Effect.succeed({ punctuation: "!" }),
  methods: (state) => ({
    greet: (name: string) =>
      Effect.map(Prefix, (prefix) => `${prefix}${name}${state.punctuation}`),
  }),
});

const live = Greetings.layer.pipe(
  Layer.provide(Layer.succeed(Prefix, "Hello ")),
);

const greeting = Effect.gen(function* () {
  const greetings = yield* Greetings;
  return yield* greetings.greet("Ada");
}).pipe(Effect.provide(live));
```

`Greetings` is a native Context service. `Greetings.layer` requires `Prefix`; a resolved service's `greet` method does not. Tests can replace the service directly with `Layer.succeed(Greetings, { greet: ... })`.

## Contract

- `initialize` and ordinary methods may use only declared services, plus `Scope.Scope`.
- Initialization scope belongs to the Layer. A method's scope belongs to its caller and remains visible in its type. Scope cannot be a declared dependency.
- Initializer failures remain in the Layer error type; method failures remain on each method.
- Private initialization state is available to the method factory and is not part of the public service interface.
- Dependency identifiers must be unique, following normal Effect Context conventions.

For named `Effect.fn` generator return annotations, `ServiceRequirements<typeof requirements, Success, Failure, Scope.Scope>` describes the declared requirements and optional caller scope. It is optional when inference is enough.

## Generic methods

TypeScript cannot generally subtract dependencies from arbitrary generic function signatures without losing their relationships. Services with an empty `requires` list may mark a generic method with `genericMethod(fn)` to preserve its full signature, including caller requirements. Generic methods with declared dependencies and structurally distinct overloads are rejected. Prefer ordinary monomorphic methods for application services.

## Scope

This package only defines services. It does not register RPC operations, manage transactions, add retries, or change Effect's Layer lifetime and memoization rules. It targets the workspace's Effect 4 release candidate; no Effect 3 compatibility is claimed.

## Validation

`pnpm ready` checks formatting, TypeScript 7, runtime binding/lifetime behavior, positive and negative compiler fixtures, declaration generation, and an installed tarball consumer. Compiler fixtures cover undeclared dependencies, caller scopes, generic signatures, invalid members, and the public/private boundary.
