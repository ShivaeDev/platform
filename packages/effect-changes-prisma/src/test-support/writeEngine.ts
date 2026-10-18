import { Effect } from "effect";
import { makePrismaChanges } from "#changes.ts";
import type { UnnamedWrite } from "#write.ts";

interface Delegate<TName extends string, TScalars> {
	readonly [key: symbol]: { readonly types: { readonly payload: { readonly name: TName; readonly scalars: TScalars } } };
}

interface Client {
	$transaction: <TX>(run: (tx: Client) => Promise<TX>) => Promise<TX>;
	readonly auditNote: Delegate<"AuditNote", { readonly id: string }>;
	readonly invoice: Delegate<"Invoice", { readonly ownerId: string }>;
	readonly membership: Delegate<"Membership", { readonly memberId: string; readonly ownerId: string }>;
}

const models = { AuditNote: null, Membership: (row: { readonly memberId: string; readonly ownerId: string }) => [row.ownerId, row.memberId] };

export function writeEngine() {
	const client: Client = { $transaction: (run) => run(client), auditNote: {}, invoice: {}, membership: {} };
	const published: (readonly string[])[] = [];
	const unnamed: UnnamedWrite[] = [];
	const changes = makePrismaChanges({
		client,
		models,
		name: "Writes",
		publish: (batch: readonly string[]) => Effect.sync(() => published.push(batch)),
	});
	return {
		published,
		record: (model: string, operation: string, result: unknown) =>
			changes
				.recordWrite({ model, operation, result })
				.pipe(Effect.provideService(changes.Unnamed, (write) => Effect.sync(() => unnamed.push(write)))),
		unnamed,
	};
}
