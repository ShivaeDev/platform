export interface TransactionOptions {
	readonly isolationLevel?: "ReadUncommitted" | "ReadCommitted" | "RepeatableRead" | "Serializable";
	readonly maxWait?: number;
	readonly timeout?: number;
}

export interface Transactional<Tx> {
	$transaction: <X>(run: (tx: Tx) => Promise<X>, options?: TransactionOptions) => PromiseLike<X>;
}

type PayloadOf<Delegate> = Delegate extends { readonly [key: symbol]: { readonly types: { readonly payload: infer Payload } } } ? Payload : never;

type Delegates<Client> = Exclude<keyof Client & string, `$${string}`>;

export type ModelName<Client> = {
	[Key in Delegates<Client>]: PayloadOf<Client[Key]> extends { readonly name: infer Name extends string } ? Name : never;
}[Delegates<Client>];

export type ModelRow<Client, Model extends string> = Extract<
	{
		[Key in Delegates<Client>]: PayloadOf<Client[Key]> extends { readonly name: Model; readonly scalars: infer Row } ? Row : never;
	}[Delegates<Client>],
	object
>;

export type RowOperation = "create" | "update" | "upsert" | "delete" | "createManyAndReturn" | "updateManyAndReturn";

export type CountOperation = "createMany" | "updateMany" | "deleteMany";

export type ModelChanges<Row, A> = (row: Row, operation: RowOperation) => Iterable<A>;

export type ChangeMap<Client, A> = {
	readonly [Model in ModelName<Client>]: ModelChanges<ModelRow<Client, Model>, A> | null;
};

export const rowOperations: ReadonlySet<string> = new Set<RowOperation>([
	"create",
	"update",
	"upsert",
	"delete",
	"createManyAndReturn",
	"updateManyAndReturn",
]);

export const countOperations: ReadonlySet<string> = new Set<CountOperation>(["createMany", "updateMany", "deleteMany"]);

export const delegateOf = (model: string): string => `${model.charAt(0).toLowerCase()}${model.slice(1)}`;
