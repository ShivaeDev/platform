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

export const PROMISE_BRIDGE =
	"export async function bridge() { try { await new Promise((resolve) => resolve(1)).then(String); } finally { throw new Error('bad'); } }";
