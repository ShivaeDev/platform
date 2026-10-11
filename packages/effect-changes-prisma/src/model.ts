export interface TransactionOptions {
	readonly isolationLevel?: "ReadUncommitted" | "ReadCommitted" | "RepeatableRead" | "Serializable";
	readonly maxWait?: number;
	readonly timeout?: number;
}

export interface Transactional<TTx> {
	$transaction: <TX>(run: (tx: TTx) => Promise<TX>, options?: TransactionOptions) => PromiseLike<TX>;
}

type PayloadOf<TDelegate> = TDelegate extends { readonly [key: symbol]: { readonly types: { readonly payload: infer TPayload } } } ? TPayload : never;

type Delegates<TClient> = Exclude<keyof TClient & string, `$${string}`>;

export type ModelName<TClient> = {
	[TKey in Delegates<TClient>]: PayloadOf<TClient[TKey]> extends { readonly name: infer TName extends string } ? TName : never;
}[Delegates<TClient>];

export type ModelRow<TClient, TModel extends string> = Extract<
	{
		[TKey in Delegates<TClient>]: PayloadOf<TClient[TKey]> extends { readonly name: TModel; readonly scalars: infer TRow } ? TRow : never;
	}[Delegates<TClient>],
	object
>;

export type RowOperation = "create" | "update" | "upsert" | "delete" | "createManyAndReturn" | "updateManyAndReturn";

export type CountOperation = "createMany" | "updateMany" | "deleteMany";

export type ModelChanges<TRow, A> = (row: TRow, operation: RowOperation) => Iterable<A>;

export type ChangeMap<TClient, A> = {
	readonly [TModel in ModelName<TClient>]: ModelChanges<ModelRow<TClient, TModel>, A> | null;
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
