export const SERVICE_DECLARATION =
	'import { Context, Effect } from "effect"; export interface StoreShape { readonly read: () => Effect.Effect<string> } export class Store extends Context.Service<Store, StoreShape>()("Store") {}';

export const SERVICE_CASES = [
	"const shorthand = (store: Renamed) => store; export const exposed = { shorthand };",
	"export function makeGeneric<T>() { return (store: T) => store; } export const generic = makeGeneric<Renamed>();",
	"export const optional = () => true ? ((store: Renamed) => store) : undefined;",
	"export declare const declared: (store: Renamed) => StoreShape;",
	"const methods = { run: (store: Renamed) => store }; export const methodAlias = methods.run;",
	"export const direct = (store: Store) => store;",
	"export const alias = (store: Renamed) => store;",
	"export const destructured = ({ store }: Wrapper) => store;",
	"export const constrained = <T extends Renamed>(store: T) => store;",
	"export const factory = () => ({ run: (store: Renamed) => store });",
	"export function context(services: Context.Context<Store>) { return services; }",
	"export class Client { run(store: Renamed) { return store; } }",
	"const local = (store: Renamed) => store; export { local as renamed };",
	"export const inferred: (store: Renamed) => string = (store) => String(store);",
	"export const tag = (store: typeof Store) => store;",
	"export default (store: Renamed) => store;",
	"export const collection = (stores: readonly StoreShape[]) => stores;",
	"export const tuple = () => [(store: Renamed) => store] as const;",
	"const wrap = <T>(value: T) => value; export const wrapped = wrap((store: Renamed) => store);",
	"export const nested = () => ({ factory: () => ({ run: ({ store }: Wrapper) => store }) });",
];

export const REJECTED_SERVICE_SOURCE = `${SERVICE_DECLARATION}
type Renamed = StoreShape;
interface Wrapper { readonly store: Renamed }
${SERVICE_CASES.join("\n")}`;

export const DATA_WITH_CALLABLE_SERVICE = `import { Context, Effect, Option, Schema } from "effect";
interface Row { readonly id: string }
type Invalidate = (payload: unknown, result: unknown) => readonly Row[];
export class Invalidation extends Context.Service<Invalidation, Invalidate>()("Invalidation") {}
type Lookup = <T extends "get">(tag: T) => T extends "get" ? Effect.Effect<string> : never;
export class LookupService extends Context.Service<LookupService, Lookup>()("Lookup") {}
export const rows = (values: readonly Row[]) => values.map(({ id }) => id);
export const viewer = (value: Option.Option<Row>) => Option.isSome(value);
export const schema = (codec: Schema.Top) => codec;
export const client = (lookup: Lookup) => lookup;
export const direct = (invalidate: Invalidate) => invalidate;
export const nested = (services: { readonly invalidate: Invalidate }) => services.invalidate;`;

export const PROMISE_BRIDGE =
	"export async function bridge() { try { await new Promise((resolve) => resolve(1)).then(String); } finally { throw new Error('bad'); } }";
