# @shivaedev/effect-contract

Declare queries and commands once. Each declaration becomes an ordinary native Effect `Rpc`, grouped into a native `RpcGroup`, plus the typed rejection classes and reactivity keys that application code would otherwise repeat by hand. Handlers, middleware, servers and clients stay native.

```ts
import { Schema } from "effect";
import { collection } from "@shivaedev/effect-contract/keys.ts";
import { command, query } from "@shivaedev/effect-contract/operation.ts";
import { contract } from "@shivaedev/effect-contract/contract.ts";
import { fieldRejection } from "@shivaedev/effect-contract/rejection.ts";

class Order extends Schema.Class<Order>("Order")({ id: Schema.Number, name: Schema.String, quantity: Schema.Number }) {}
class OrderNotFound extends Schema.TaggedError<OrderNotFound>()("OrderNotFound", {}) {}
const OrderDraft = Schema.Struct({ name: Order.fields.name, quantity: Order.fields.quantity });

export const orders = collection("orders", Order.fields.id);

export const GetOrder = query("get", {
  payload: { id: Schema.Number },
  success: Order,
  rejections: { OrderNotFound },
  reads: ({ id }) => [orders.item(id)],
});
export const ListOrders = query("list", { success: Schema.Array(Order), reads: () => [orders.list] });
export const SaveOrder = command("save", {
  payload: { id: Schema.Number, ...OrderDraft.fields },
  success: Order,
  rejections: { OrderNotFound, OrderValidation: fieldRejection(OrderDraft) },
  invalidates: ({ id }) => [orders.item(id)],
});

export const Orders = contract("orders", { queries: [GetOrder, ListOrders], commands: [SaveOrder] }).middleware(Authentication);
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
| `Key` / `LiveHint` | Schemas in `keys.ts` / `live.ts` | existing list/item keys and optional Changed/Resync hints |
| `resumeSignal` | `resumeSignal({ window?, native? })` in `resume.ts` | scoped native atom for visible browser resume/online and injected native resume |
| `live` | `live(atomRuntime, { stream, resyncKeys, resume?, retryDelay? })` | native connection atom, writable pause atom and typed status atom |

Payload accepts struct fields or any schema, as in `Rpc.make`. Omitted payload and success are `Schema.Void`.

Optional [live updates](../../docs/framework/live-updates.md) compose native
Streams, RPC, Reactivity and AtomRegistry without React or a second cache. The
guide distinguishes library behavior, real HTTP/browser fixture evidence and
application adoption, and explains why streaming HTTP uses native NDJSON.

### Operations and rejections

- Each operation exposes `payload`, `success`, `error` (the rejection union, or `Schema.Never` without rejections), `Rejection.X` (the class) and `reject.X(...)`, an `Effect<never, X>`.
- `rejections: { Tag: fields }` generates a `Schema.TaggedError` class with that `_tag`. `rejections: { Tag: ExistingClass }` reuses a class; its `_tag` must equal the key. Reuse one class when several operations or a shared service raise the same rejection. Generated classes are distinct per operation.
- `fieldRejection(OrderDraft)` derives the `field` literal union from the struct's keys, so a form can attach the rejection to one of its own fields. Pass a key list to narrow it.

### Contract

- RPC tags are `` `${contract}.${operation}` ``. Implement handlers with native `Orders.toLayer(Effect.gen(...))` and `Orders.of({ "orders.get": ... })`; `of` rejects wrong payloads, successes and undeclared failures.
- Middleware is the native `.middleware(M)`. On a contract it returns a contract, keeping `declaration` (`{ name, queries, commands }`). Other native group combinators (`add`, `merge`, `prefix`, `omit`) return plain groups.
- Operation names in one contract must all differ, across and within queries and commands. The compiler rejects duplicates in literal arrays; `contract` throws for duplicates it cannot see.
- Operations can be declared inline in `contract(...)` or beforehand; both keep the same types and defaults.

### Reactivity keys

`collection("orders", Order.fields.id)` gives `orders.list` and `orders.item(id)`; ids must be strings or numbers. The binding applies the one rule that is easy to get wrong with native keys:

| Declared | Query registers | Command invalidates |
| --- | --- | --- |
| `orders.item(id)` | `` `orders:${id}` `` | `` `orders:${id}` `` and `"orders"` |
| `orders.list` | `"orders"` | `"orders"` |

An item change therefore refreshes that item and every list, but not other items. Invalidating `orders.list` does not refresh item queries. The strings match native Reactivity's hashing of `{ orders: [id] }`.

### Client binding

`bind` is browser-safe and uses no React:

```ts
class OrdersClient extends AtomRpc.Service<OrdersClient>()("app/OrdersClient", { group: Orders, protocol }) {}
const api = bind(Orders, OrdersClient);

api.get.query({ id }, { timeToLive: "1 minute" }); // native Client.query atom with the declared read keys
api.get.run({ id });                                // one call, no registration
api.save.run(input);                                // Effect: call, then invalidate declared keys
```

- `query` returns the native `AtomRpc` query atom; `headers`, `timeToLive` and `serializationKey` pass through.
- `run` returns `Effect<Success, Rejection | middleware error | RpcClientError, OrdersClient | Reactivity>` for that single invocation. Run it through the service's atom runtime (for example as a form's submit handler) so invalidation reaches the same registry. Keys, including result-dependent keys, are invalidated only after success.
- There is no shared mutation atom or second cache.

Authorization and transactions stay in handlers and services. For server-side invalidation after a SQL commit, see `transact` in `@shivaedev/effect-sql`.

This release targets Effect `4.0.0-rc.112`.
