# @shivaedev/effect-service

Declare an Effect service's dependencies once, initialize its private state, and call its methods without supplying those dependencies again. The service remains a native Context service with a native Layer; its methods remain Effects with their own result, failure and caller scope types.

## Why you want this

A service should explain what it needs and what callers can do with it. When every method binds dependencies separately, that explanation is scattered across setup and application code. Put the dependency list, private initialization and public methods in one definition:

```ts
const Greetings = defineService({
  id: "app/Greetings",
  requires: [Prefix],
  initialize: Effect.succeed({ punctuation: "!" }),
  methods: (state) => ({
    greet: Effect.fn("Greetings.greet")((name: string) =>
      Effect.map(Prefix, (prefix) => `${prefix}${name}${state.punctuation}`),
    ),
  }),
});
```

`Prefix` is an Effect service. Provide it to `Greetings.layer` once; callers ask for `Greetings` and call `greet(name)`. The punctuation stays private, the prefix stays bound to the service's dependency, and each caller sees an ordinary Effect instead of dependency plumbing.

## Using it

### How to think about it

A **service definition** has four parts: an identity, a list of required services, an initialization Effect, and a function that turns its private state into methods. `defineService` returns the native Context service callers yield and its `.layer`, which applications compose with the dependencies' Layers.

A **declared dependency** is a service tag in `requires`. The Layer supplies those services to initialization and binds them to each method. The public method's type removes their requirements. If a caller provides a different value for a declared dependency around a method call, the method still uses the value supplied when the service was initialized.

**Private initialization state** is the value returned by `initialize`. The method factory receives it, but a caller receives only the methods. Within one provided Layer's lifetime, initialization and the method factory each run once, and two reads of the service share the same state.

**Caller scope** is different from initialization scope. The Layer owns initialization resources and runs their finalizers when its scope closes. A method that acquires a scoped resource keeps `Scope.Scope` in its public requirement type; its caller supplies the scope and releases the resource when that scope closes, even while the service stays live.

The work has three parts:

1. Once at the application boundary, compose service Layers with their dependencies.
2. Once per service, define its dependency list, private state and methods.
3. In application code, yield the service and call its methods.

### 1. Define a service and provide its dependencies

```ts
import { Context, Effect, Layer } from "effect";
import { defineService } from "@shivaedev/effect-service/define-service.ts";

class Prefix extends Context.Service<Prefix, string>()("app/Prefix") {}

const Greetings = defineService({
  id: "app/Greetings",
  requires: [Prefix],
  initialize: Effect.succeed({ punctuation: "!" }),
  methods: (state) => ({
    greet: Effect.fn("Greetings.greet")((name: string) =>
      Effect.map(Prefix, (prefix) => `${prefix}${name}${state.punctuation}`),
    ),
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

The Layer needs `Prefix`. After a caller resolves `Greetings`, `greet` needs no `Prefix` from that caller. Its argument and success type are inferred from the method. Initialization's failure type belongs to the Layer; each method keeps its own failure type.

`initialize` and ordinary methods may require the listed services and `Scope.Scope`. A definition that reads another service is rejected by the compiler fixtures. Scope is supplied by the Layer or method caller, so `Scope.Scope` itself cannot appear in `requires`.

Return functions from the method factory, each producing an Effect. An Effect value placed directly in the method record is rejected. Keep the private state behind those functions; it is absent from the emitted public service declaration.

### 2. Annotate generators when inference needs help

For an explicitly annotated `Effect.fn` generator, `ServiceRequirements` expresses the declared services without repeating their union:

```ts
import { Context, Effect, type Scope } from "effect";
import { defineService } from "@shivaedev/effect-service/define-service.ts";
import type { ServiceRequirements } from "@shivaedev/effect-service/service-requirements.ts";

class Declared extends Context.Service<Declared, { readonly identity: object }>()(
  "app/Declared",
) {}

const requirements = [Declared] as const;

type Requirements<Success, Failure = never, CallerScope extends Scope.Scope = never> =
  ServiceRequirements<typeof requirements, Success, Failure, CallerScope>;

const Identity = defineService({
  id: "app/Identity",
  requires: requirements,
  initialize: Effect.fn("Identity.initialize")(function* (): Requirements<{
    readonly identity: object;
  }> {
    return { identity: (yield* Declared).identity };
  })(),
  methods: (state) => ({
    sameIdentity: Effect.fn("Identity.sameIdentity")(function* (): Requirements<boolean> {
      return (yield* Declared).identity === state.identity;
    }),
  }),
});
```

The alias is `Effect.fn.Return<Success, Failure, declared services | CallerScope>`. The last parameter can be `Scope.Scope` when the generator acquires a scoped resource; it cannot add another undeclared service. The annotation describes the implementation's requirements. `defineService` removes declared dependencies from the public methods' requirements.

### 3. Give method resources a caller scope

```ts
import { Effect, Ref } from "effect";
import { defineService } from "@shivaedev/effect-service/define-service.ts";

const Resources = defineService({
  id: "app/Resources",
  requires: [],
  initialize: Ref.make(0),
  methods: (released) => ({
    open: Effect.fn("Resources.open")(() =>
      Effect.acquireRelease(
        Effect.succeed("resource"),
        () => Ref.update(released, (count) => count + 1),
      ),
    ),
    released: Effect.fn("Resources.released")(() => Ref.get(released)),
  }),
});

const useResource = Effect.gen(function* () {
  const resources = yield* Resources;
  yield* Effect.scoped(resources.open());
  return yield* resources.released();
}).pipe(Effect.provide(Resources.layer));
```

`open()` requires a caller scope. `Effect.scoped` supplies it and closes it before the next method call. The finalizer updates the private counter while the service is still available. An initializer that registers a finalizer instead ties that finalizer to the service Layer's scope.

### Replace a service at an external test boundary

A native Layer can provide the method interface directly:

```ts
const testGreetings = Layer.succeed(Greetings, {
  greet: Effect.fn("TestGreetings.greet")((name: string) => Effect.succeed(name)),
});
```

The replacement provides the public method interface, rather than private initialization state. The compiler fixtures reject a replacement that leaves a required method out. Keep the real service in tests of its behavior; use a replacement where the service represents an external boundary.

### Preserve a generic method's signature

Ordinary methods have one concrete signature. For a service with an empty `requires` list, `genericMethod` marks a generic function so its success, failure and caller requirements remain related at each call:

```ts
import { Context, Effect } from "effect";
import { defineService } from "@shivaedev/effect-service/define-service.ts";
import { genericMethod } from "@shivaedev/effect-service/generic-method.ts";

class Caller extends Context.Service<Caller, { readonly value: number }>()(
  "app/Caller",
) {}

const preserve = Effect.fn("Generic.preserve")(
  <Success, Failure, Requirements>(
    effect: Effect.Effect<Success, Failure, Requirements>,
  ): Effect.Effect<{ readonly value: Success }, Failure, Requirements> =>
    Effect.map(effect, (value) => ({ value })),
);

const Generic = defineService({
  id: "app/Generic",
  requires: [],
  initialize: Effect.void,
  methods: () => ({ preserve: genericMethod(preserve) }),
});

const preserved = Effect.gen(function* () {
  const service = yield* Generic;
  return yield* service.preserve(Effect.map(Caller, ({ value }) => value));
}).pipe(
  Effect.provide(Generic.layer),
  Effect.provideService(Caller, { value: 42 }),
);
```

The wrapped Effect still requires `Caller`, which the caller supplies separately. The generic service's Layer has no declared dependencies. The emitted declarations preserve the generic success and failure types as well as caller requirements.

Marked generic methods require a service with no declared dependencies. The
compiler fixtures reject an unmarked generic that correlates its input and
returned Effect, and a structurally distinct two-signature overload. Those
checks do not establish rejection of every generic or overloaded signature.
Use ordinary methods with concrete signatures when the service binds dependencies.

Dependency binding wraps the method's outer returned Effect. A Stream returned
as its value retains its own service requirements; provide them when running
the Stream.

### API

Import the module that defines the name:

| Module | Name | Use |
| --- | --- | --- |
| `@shivaedev/effect-service/define-service.ts` | `defineService(definition)` | Create a native service with its `.layer`. |
| `@shivaedev/effect-service/generic-method.ts` | `genericMethod(method)` | Mark a generic Effect-returning function in a service with no declared dependencies. |
| `@shivaedev/effect-service/service-requirements.ts` | `ServiceRequirements<Requirements, Success, Failure = never, CallerScope = never>` | Annotate an `Effect.fn` generator with declared dependencies and optional caller scope. |

The definition's fields are:

| Field | Meaning |
| --- | --- |
| `id` | The Context service identity, also retained in the Layer's output type. |
| `requires` | A readonly list of service tags available to initialization and ordinary methods. |
| `initialize` | The Effect producing private state; its failure type becomes the Layer's failure type. |
| `methods(state)` | A function returning the public method record, with declared dependencies removed from ordinary methods' requirement types. |

The exported supporting types are listed here for readers of generated declarations. Service authors use the entry points above.

| Module | Supporting type exports |
| --- | --- |
| `generic-method.ts` | `AnyMethod`, `GenericMethodDescriptor`, `HasDistinctCallSignatures`, `GenericOrStructurallyOverloadedMethodsAreUnsupported` |
| `service-requirements.ts` | `RequirementRecord`, `RequirementsOf` |
| `initializer-proof.ts` | `InitializerProof` |
| `method-proof.ts` | `MethodEntry`, `MethodRecord`, `MethodInventory`, `RuntimeMethodInventory`, `MethodProof` |
| `requirement-proof.ts` | `RequirementProof` |

### Install and limits

```sh
pnpm add @shivaedev/effect-service effect@4.0.0-rc.112
```

`effect` is a peer dependency. The repository catalog uses Effect `4.0.0-rc.112`, and the package declares Node.js 24 or later. The examples use that Effect API.

- Private state is hidden by the public interface, rather than exposed as another service field.
- Ordinary methods may leave only caller scope unresolved. A generic method explicitly marked in a requirement-free service may retain its caller's services.
- Keep request identity at the request boundary when it changes per call. Pass it as a method argument rather than binding it into a service intended to live across requests.
- Choose service Layer lifetimes at the application's composition boundary; keep initialization resource ownership separate from a method caller's scope.
