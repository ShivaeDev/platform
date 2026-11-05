# @shivaedev/service

Declare once what an Effect service requires, and write its operations as ordinary `Effect.fn` exports that `yield*` their dependencies and the caller. Callers use the service without providing those dependencies again. The service remains a native Context service with a native Layer, and its Layer is its lifetime.

## Why you want this

A service should say what it needs and what callers can do with it. When operations take a repository, a client or the user's id as arguments, that knowledge spreads into every caller and every caller can get it wrong. Here each operation reads what it needs from the environment, including who asked:

```ts
import { Effect } from "effect";
import { SessionUser } from "@shivaedev/identity/identity.ts";
import { BookmarkRows } from "#bookmarks/BookmarkRows.ts";

export const list = Effect.fn("Bookmarks.list")(function* () {
	const user = yield* SessionUser;
	const rows = yield* BookmarkRows;
	return yield* rows.ownedBy(user.id);
});
```

The service lists its requirements once and names its operations:

```ts
import { Effect } from "effect";
import { SessionUser } from "@shivaedev/identity/identity.ts";
import { defineService } from "@shivaedev/service/defineService.ts";
import { add } from "#bookmarks/add.ts";
import { BookmarkRows } from "#bookmarks/BookmarkRows.ts";
import { list } from "#bookmarks/list.ts";

export const Bookmarks = defineService({
	id: "app/Bookmarks",
	requires: [BookmarkRows, SessionUser],
	initialize: Effect.void,
	methods: () => ({ add, list }),
});
```

A handler yields `Bookmarks` and calls `list()`. It passes no user id and no repository, so nothing a caller passes can make it list another account's bookmarks.

## Using it

### How to think about it

A **service definition** has four parts: an identity, the services it requires, an initialization Effect for the state it owns, and its operations. `defineService` returns the native Context service callers yield and its `.layer`, which the application composes with the dependencies' Layers.

An **operation** is an `Effect.fn("Service.operation")` export in its own file, in the service's folder beside its `service.ts`. It reads every dependency with `yield*`: repositories, `SqlClient`, HTTP clients, config, other services and the caller. A dependency never arrives as a parameter, a closure capture or a bundle, and the acting user's id is never an argument. A target id, such as the account an administrator acts on, is an ordinary argument.

A **declared dependency** is a service tag in `requires`. The Layer supplies those services to initialization and binds them to each operation, and the public operation's type no longer requires them. If a caller provides a different value for a declared dependency around a call, the operation still uses the value supplied when the Layer was built.

The **lifetime** of a service is its Layer's. Each build of the Layer runs `initialize` once, and every call on that build shares its state. Where the Layer is registered decides the lifetime: built once by the host, the service is global; built for each request, it is per request and may require the caller, such as `SessionUser` or `Subject`, which the host provides for that request; built with `Layer.fresh` or for a single use, it is fresh each time. A service that requires the caller cannot be built globally, because nothing global provides the caller.

**Owned state** is the value `initialize` returns: caches, refs, locks, and values captured from the context at setup, such as the caller a per-request service captures. It never holds a dependency. A caller receives only the operations. When reaching a dependency seems to need a closure or a factory, the dependency should be a service of its own; add it instead.

**Caller scope** is different from initialization scope. The Layer owns initialization resources: their finalizers run once when its scope closes or its owner is interrupted, including when initialization is still running. An operation that acquires a scoped resource keeps `Scope.Scope` in its public requirement type; its caller supplies the scope and releases the resource when that scope closes, even while the service stays live. Interrupting a call in `Effect.scoped` interrupts the call and releases its resources without ending the service's lifetime.

The work has three parts:
1. Once at the application boundary, register each service Layer where its lifetime belongs and compose it with its dependencies' Layers.
2. Once per service, write its operations and assemble its definition.
3. In application code, yield the service and call its operations.

### 1. Write operations and assemble the service

A service file is an inventory: a top-level `defineService` call lists `id`, `requires`, `initialize` and `methods` directly. Keep each operation in its own file and import its named export. Use `Effect.void` when the service owns no state; the methods arrow then takes no argument and returns the record of imported operations.

Quality enforces this with `effect/service-definition-assembly`, including adapters and tests. It rejects a configuration hidden behind a variable, spreads or computed configuration members, hidden method records, inline operations, local implementation references and implementation bodies beside the assembly. Quality's span checks apply to the operations: name each span after the service and the operation, such as `Greetings.greet`, with the operation matching its binding.

An operation yields its dependencies. `Prefix` is a separate native Context service:

```ts
import { Effect } from "effect";
import { Prefix } from "#Prefix.ts";

export const greet = Effect.fn("Greetings.greet")(function* (name: string) {
	const prefix = yield* Prefix;
	return `${prefix}${name}`;
});
```

The service module imports it:

```ts
import { Effect } from "effect";
import { defineService } from "@shivaedev/service/defineService.ts";
import { greet } from "#greetings/greet.ts";
import { Prefix } from "#Prefix.ts";

export const Greetings = defineService({
	id: "app/Greetings",
	requires: [Prefix],
	initialize: Effect.void,
	methods: () => ({ greet }),
});
```

Application code composes its Layer and calls the service:

```ts
import { Effect, Layer } from "effect";

const live = Greetings.layer.pipe(Layer.provide(Layer.succeed(Prefix, "Hello ")));

const greeting = Effect.gen(function* () {
	const greetings = yield* Greetings;
	return yield* greetings.greet("Ada");
}).pipe(Effect.provide(live));
```

The Layer needs `Prefix`. After a caller resolves `Greetings`, `greet` needs no `Prefix` from that caller. Its argument and success type are inferred from the operation. An initialization failure fails the Layer build with that typed error and runs finalizers registered before the failure. An operation failure reaches the caller as that operation's typed error, and the same service instance can handle the next call. An operation defect remains a defect.

`initialize` and ordinary operations may require the listed services and `Scope.Scope`. The compiler rejects a definition that reads another service. For an ordinary operation, the diagnostic names the operation and its missing service types, such as `MethodHasUndeclaredServiceRequirements<"write", Reactivity>`. When an operation is missing several services, the diagnostic includes their union; declared services and caller scope are excluded. Scope is supplied by the Layer or the caller, so `Scope.Scope` itself cannot appear in `requires`.

Native `Context.Reference` keys can appear in `requires`. Their defaults make them requirement-free in Effect, so they add no Layer dependency, including when the reference's value is a scope.

The method record holds functions, each producing an Effect. An Effect value placed directly in the record is rejected.

### 2. Keep owned state in the initializer

A service that owns state for its lifetime returns it from `initialize`, and the operations that use it are exported as state factories: functions of the state that return the `Effect.fn` operation. Use this only for state the service owns, never to reach a dependency.

A per-request service can cache a lookup within its request. The initializer builds the cache once per Layer build; `loadTodayWater` is an operation that yields its own dependencies, such as the caller and a repository:

```ts
import { Effect } from "effect";
import { loadTodayWater } from "#water/loadTodayWater.ts";

export const initializeWater = Effect.gen(function* () {
	return { today: yield* Effect.cached(loadTodayWater()) };
});
```

The operation reads the cache from the state:

```ts
import { Effect } from "effect";
import type { initializeWater } from "#water/initialize.ts";

export function todayTotal(state: Effect.Success<typeof initializeWater>) {
	return Effect.fn("Water.todayTotal")(function* () {
		const entries = yield* state.today;
		return entries.reduce((sum, entry) => sum + entry.millilitres, 0);
	});
}
```

The assembly passes the state on: `methods: (state) => ({ todayTotal: todayTotal(state) })`. Every call within one build of the Layer shares the cached result; a request that builds its own Layer loads again.

### 3. Annotate generators when inference needs help

For an explicitly annotated `Effect.fn` generator, `ServiceRequirements` expresses the declared services without repeating their union:

```ts
import { Context, Effect, type Scope } from "effect";
import type { ServiceRequirements } from "@shivaedev/service/ServiceRequirements.ts";

class Declared extends Context.Service<Declared, { readonly identity: object }>()("app/Declared") {}

const requirements = [Declared] as const;

type Requirements<Success, Failure = never, CallerScope extends Scope.Scope = never> = ServiceRequirements<
	typeof requirements,
	Success,
	Failure,
	CallerScope
>;

export const initializeIdentity = Effect.fn("Identity.initializeIdentity")(function* (): Requirements<{
	readonly identity: object;
}> {
	return { identity: (yield* Declared).identity };
})();
```

The alias is `Effect.fn.Return<Success, Failure, declared services | CallerScope>`. The last parameter can be `Scope.Scope` when the generator acquires a scoped resource; it cannot add another undeclared service. The annotation describes the implementation's requirements. `defineService` removes declared dependencies from the public operations' requirements.

### 4. Give operation resources a caller scope

```ts
import { Effect, Ref } from "effect";

export function open(released: Ref.Ref<number>) {
	return Effect.fn("Resources.open")(() => Effect.acquireRelease(Effect.succeed("resource"), () => Ref.update(released, (count) => count + 1)));
}
```

The counter is state the service owns. The assembly imports `open`, a `released` state factory and an initializer that returns `Ref.make(0)`. Its methods inventory is `(state) => ({ open: open(state), released: released(state) })`. A caller can then use:

```ts
const useResource = Effect.gen(function* () {
	const resources = yield* Resources;
	yield* Effect.scoped(resources.open());
	return yield* resources.released();
}).pipe(Effect.provide(Resources.layer));
```

`open()` requires a caller scope. `Effect.scoped` supplies it and closes it before the next call. The finalizer updates the private counter while the service is still available. An initializer that registers a finalizer instead ties that finalizer to the service Layer's scope.

### Replace a service at an external test boundary

A native Layer can provide the operation interface directly:

```ts
const testGreetings = Layer.succeed(Greetings, {
	greet: Effect.fn("TestGreetings.greet")((name: string) => Effect.succeed(name)),
});
```

The replacement provides the public operation interface, rather than owned state. The compiler rejects a replacement that leaves a required operation out. Keep the real service in tests of its behavior; use a replacement where the service represents an external boundary.

### Preserve a generic method's signature

Ordinary methods have one concrete signature. `genericMethod` marks a generic function so its success, failure and caller requirements remain related at each call:

```ts
import { Effect } from "effect";

export const preserve = Effect.fn("Generic.preserve")(
	<Success, Failure, Requirements>(
		effect: Effect.Effect<Success, Failure, Requirements>,
	): Effect.Effect<{ readonly value: Success }, Failure, Requirements> => Effect.map(effect, (value) => ({ value })),
);
```

The assembly imports the generic operation and marks it in the inventory:

```ts
import { Context, Effect } from "effect";
import { defineService } from "@shivaedev/service/defineService.ts";
import { genericMethod } from "@shivaedev/service/genericMethod.ts";
import { preserve } from "#preserve.ts";

class Caller extends Context.Service<Caller, { readonly value: number }>()("app/Caller") {}

const Generic = defineService({
	id: "app/Generic",
	requires: [],
	initialize: Effect.void,
	methods: () => ({ preserve: genericMethod(preserve) }),
});
```

A caller keeps the generic operation's requirements:

```ts
const preserved = Effect.gen(function* () {
	const service = yield* Generic;
	return yield* service.preserve(Effect.map(Caller, ({ value }) => value));
}).pipe(Effect.provide(Generic.layer), Effect.provideService(Caller, { value: 42 }));
```

The wrapped Effect still requires `Caller`, which the caller supplies separately. The generic service's Layer has no declared dependencies. The emitted declarations preserve the generic success and failure types as well as caller requirements.

A generic method's remaining requirements follow native Effect rules: execution without them is a compile error. Composing the call into a Layer retains those dependencies until they are provided; an initializer cannot use the call unless its service declares those dependencies.

Marked generic methods also work with declared initializer dependencies. Their signatures keep all caller requirements unchanged; unlike ordinary methods, they do not subtract declared dependencies from the public signature. The compiler rejects an unmarked generic that correlates its input and returned Effect, and a structurally distinct two-signature overload; it may not reject other generic or overloaded signatures.

Dependency binding wraps the operation's outer returned Effect. A Stream returned as its value retains its own service requirements; provide them when running the Stream.

### API

Import the module that defines the name:

| Module                                      | Name                                                                               | Use                                                                                     |
| ------------------------------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `@shivaedev/service/defineService.ts`       | `defineService(definition)`                                                        | Create a native service with its `.layer`.                                              |
| `@shivaedev/service/genericMethod.ts`       | `genericMethod(method)`                                                            | Preserve a generic Effect-returning function and its caller requirements.               |
| `@shivaedev/service/ServiceRequirements.ts` | `ServiceRequirements<Requirements, Success, Failure = never, CallerScope = never>` | Annotate an `Effect.fn` generator with declared dependencies and optional caller scope. |

The definition's fields are:

| Field            | Meaning                                                                                                               |
| ---------------- | --------------------------------------------------------------------------------------------------------------------- |
| `id`             | The Context service identity, also retained in the Layer's output type.                                               |
| `requires`       | A readonly list of service tags available to initialization and ordinary operations.                                  |
| `initialize`     | The Effect producing owned state, or `Effect.void`; its failure type becomes the Layer's failure type.                |
| `methods(state)` | A function returning the public operation record, with declared dependencies removed from ordinary operations' types. |

### Install and limits

```sh
pnpm add @shivaedev/service effect
```

`effect` is a peer dependency, and the package needs Node.js 24 or later.
- `defineService` does not choose a lifetime. The application decides it by where it registers the service's Layer; a Layer that requires the caller can only be built where the caller is provided.
- Initialization resources belong to the Layer's scope, never to an operation caller's scope.
