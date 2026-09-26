# @shivaedev/effect-contract

Declare queries and commands once. Each declaration becomes an ordinary native Effect `Rpc`, grouped into a native `RpcGroup`, plus the typed rejection classes and reactivity keys that application code would otherwise repeat by hand. Handlers, middleware, servers and clients stay native.

```ts
import { Schema } from "effect";
import { collection, command, contract, fieldRejection, query } from "@shivaedev/effect-contract";

class Meal extends Schema.Class<Meal>("Meal")({ id: Schema.Number, name: Schema.String, calories: Schema.Number }) {}
class MealNotFound extends Schema.TaggedError<MealNotFound>()("MealNotFound", {}) {}
const MealDraft = Schema.Struct({ name: Meal.fields.name, calories: Meal.fields.calories });

export const meals = collection("meals", Meal.fields.id);

export const GetMeal = query("get", {
  payload: { id: Schema.Number },
  success: Meal,
  rejections: { MealNotFound },
  reads: ({ id }) => [meals.item(id)],
});
export const ListMeals = query("list", { success: Schema.Array(Meal), reads: () => [meals.list] });
export const SaveMeal = command("save", {
  payload: { id: Schema.Number, ...MealDraft.fields },
  success: Meal,
  rejections: { MealNotFound, MealValidation: fieldRejection(MealDraft) },
  invalidates: ({ id }) => [meals.item(id)],
});

export const Meals = contract("meals", { queries: [GetMeal, ListMeals], commands: [SaveMeal] }).middleware(Authentication);
```

## API

| Export | Signature (simplified) | Result |
| --- | --- | --- |
| `query` | `query(name, { payload?, success?, rejections?, reads: (payload) => Key[] })` | `Query<Name, Payload, Success, Specs>` |
| `command` | `command(name, { payload?, success?, rejections?, invalidates: (payload, result) => Key[] })` | `Command<Name, Payload, Success, Specs>` |
| `contract` | `contract(name, { queries?, commands? })` | `Contract<Name, Queries, Commands, Rpcs>`, a native `RpcGroup<Rpcs>` |
| `collection` | `collection(name, idSchema)` | `{ name, list, item(id) }` typed reactivity keys |
| `fieldRejection` | `fieldRejection(struct, keys?)` | fields `{ field: Literals<keys>, message: String }` |
| `bind` | `bind(contract, atomRpcService)` | `{ [query]: { query, run }, [command]: { run } }` |
| `readKeys` / `invalidationKeys` | `(keys: Key[]) => string[]` | native Reactivity keys |

Payload accepts struct fields or any schema, as in `Rpc.make`. Omitted payload and success are `Schema.Void`.

### Operations and rejections

- Each operation exposes `payload`, `success`, `error` (the rejection union, or `Schema.Never` without rejections), `Rejection.X` (the class) and `reject.X(...)`, an `Effect<never, X>`.
- `rejections: { Tag: fields }` generates a `Schema.TaggedError` class with that `_tag`. `rejections: { Tag: ExistingClass }` reuses a class; its `_tag` must equal the key. Reuse one class when several operations or a shared service raise the same rejection. Generated classes are distinct per operation.
- `fieldRejection(MealDraft)` derives the `field` literal union from the struct's keys, so a form can attach the rejection to one of its own fields. Pass a key list to narrow it.

### Contract

- RPC tags are `` `${contract}.${operation}` ``. Implement handlers with native `Meals.toLayer(Effect.gen(...))` and `Meals.of({ "meals.get": ... })`; `of` rejects wrong payloads, successes and undeclared failures.
- Middleware is the native `.middleware(M)`. On a contract it returns a contract, keeping `declaration` (`{ name, queries, commands }`). Other native group combinators (`add`, `merge`, `prefix`, `omit`) return plain groups.
- Operation names in one contract must all differ, across and within queries and commands. The compiler rejects duplicates in literal arrays; `contract` throws for duplicates it cannot see.
- Operations can be declared inline in `contract(...)` or beforehand; both keep the same types and defaults.

### Reactivity keys

`collection("meals", Meal.fields.id)` gives `meals.list` and `meals.item(id)`; ids must be strings or numbers. The binding applies the one rule that is easy to get wrong with native keys:

| Declared | Query registers | Command invalidates |
| --- | --- | --- |
| `meals.item(id)` | `` `meals:${id}` `` | `` `meals:${id}` `` and `"meals"` |
| `meals.list` | `"meals"` | `"meals"` |

An item change therefore refreshes that item and every list, but not other items. Invalidating `meals.list` does not refresh item queries. The strings match native Reactivity's hashing of `{ meals: [id] }`.

### Client binding

`bind` is browser-safe and uses no React:

```ts
class MealsClient extends AtomRpc.Service<MealsClient>()("app/MealsClient", { group: Meals, protocol }) {}
const api = bind(Meals, MealsClient);

api.get.query({ id }, { timeToLive: "1 minute" }); // native Client.query atom with the declared read keys
api.get.run({ id });                                // one call, no registration
api.save.run(input);                                // Effect: call, then invalidate declared keys
```

- `query` returns the native `AtomRpc` query atom; `headers`, `timeToLive` and `serializationKey` pass through.
- `run` returns `Effect<Success, Rejection | middleware error | RpcClientError, MealsClient | Reactivity>` for that single invocation. Run it through the service's atom runtime (for example as a form's submit handler) so invalidation reaches the same registry. Keys, including result-dependent keys, are invalidated only after success.
- There is no shared mutation atom or second cache.

Authorization and transactions stay in handlers and services. For server-side invalidation after a SQL commit, see `transact` in `@shivaedev/effect-sql`.

This release targets Effect `4.0.0-rc.112`.
