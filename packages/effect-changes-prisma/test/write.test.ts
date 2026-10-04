import { Effect } from "effect";
import { expect, it } from "vitest";
import { makePrismaChanges, type UnnamedWrite } from "../src/index.ts";

interface Row {
	readonly memberId: string;
	readonly ownerId: string;
}

interface Delegate<Name extends string, Scalars> {
	readonly [key: symbol]: { readonly types: { readonly payload: { readonly name: Name; readonly scalars: Scalars } } };
}

interface Client {
	$transaction: <X>(run: (tx: Client) => Promise<X>) => Promise<X>;
	readonly auditNote: Delegate<"AuditNote", { readonly id: string }>;
	readonly invoice: Delegate<"Invoice", { readonly ownerId: string }>;
	readonly membership: Delegate<"Membership", Row>;
}

const client: Client = { $transaction: (run) => run(client), auditNote: {}, invoice: {}, membership: {} };

const harness = () => {
	const published: (readonly string[])[] = [];
	const unnamed: UnnamedWrite[] = [];
	const changes = makePrismaChanges({
		client,
		models: {
			AuditNote: null,
			Membership: (row) => [row.ownerId, row.memberId],
		},
		name: "Writes",
		publish: (batch: readonly string[]) => Effect.sync(() => published.push(batch)),
	});
	const record = (model: string, operation: string, result: unknown) =>
		changes
			.recordWrite({ model, operation, result })
			.pipe(Effect.provideService(changes.Unnamed, (write: UnnamedWrite) => Effect.sync(() => unnamed.push(write))));
	return { published, record, unnamed };
};

it("recordWrite applies the map to a write observed by the application's own client", () =>
	Effect.runPromise(
		Effect.gen(function* () {
			const { published, unnamed, record } = harness();
			yield* record("Membership", "create", { memberId: "bob", ownerId: "ada" });
			yield* record("Membership", "updateManyAndReturn", [
				{ memberId: "cyd", ownerId: "ada" },
				{ memberId: "ada", ownerId: "dan" },
			]);
			yield* record("Membership", "deleteMany", { count: 2 });
			yield* record("Membership", "update", { ownerId: "ada" });
			yield* record("Membership", "findMany", [{ memberId: "fay", ownerId: "eve" }]);
			yield* record("AuditNote", "create", { id: "n1" });
			yield* record("Invoice", "create", { ownerId: "ada" });
			expect(published).toEqual([
				["ada", "bob"],
				["ada", "cyd", "dan"],
			]);
			expect(unnamed).toEqual([
				{ model: "Membership", operation: "deleteMany", reason: "countOnly" },
				{ field: "memberId", model: "Membership", operation: "update", reason: "narrowed" },
			]);
		}),
	));
