import { Effect } from "effect";
import { expect, test } from "vitest";
import { makePrismaChanges, type UnnamedWrite } from "../src/index.ts";

interface Row {
	readonly ownerId: string;
	readonly memberId: string;
}

type Delegate<Name extends string, Scalars> = {
	readonly [key: symbol]: { readonly types: { readonly payload: { readonly name: Name; readonly scalars: Scalars } } };
};

interface Client {
	readonly membership: Delegate<"Membership", Row>;
	readonly auditNote: Delegate<"AuditNote", { readonly id: string }>;
	readonly invoice: Delegate<"Invoice", { readonly ownerId: string }>;
	$transaction<X>(run: (tx: Client) => Promise<X>): Promise<X>;
}

const client: Client = { membership: {}, auditNote: {}, invoice: {}, $transaction: (run) => run(client) };

const harness = () => {
	const published: Array<ReadonlyArray<string>> = [];
	const unnamed: Array<UnnamedWrite> = [];
	const changes = makePrismaChanges({
		name: "Writes",
		client,
		models: {
			Membership: (row) => [row.ownerId, row.memberId],
			AuditNote: null,
		},
		publish: (batch: ReadonlyArray<string>) => Effect.sync(() => published.push(batch)),
	});
	const record = (model: string, operation: string, result: unknown) =>
		changes
			.recordWrite({ model, operation, result })
			.pipe(Effect.provideService(changes.Unnamed, (write: UnnamedWrite) => Effect.sync(() => unnamed.push(write))));
	return { published, unnamed, record };
};

test("recordWrite applies the map to a write observed by the application's own client", () =>
	Effect.runPromise(
		Effect.gen(function* () {
			const { published, unnamed, record } = harness();
			yield* record("Membership", "create", { ownerId: "ada", memberId: "bob" });
			yield* record("Membership", "updateManyAndReturn", [
				{ ownerId: "ada", memberId: "cyd" },
				{ ownerId: "dan", memberId: "ada" },
			]);
			yield* record("Membership", "deleteMany", { count: 2 });
			yield* record("Membership", "update", { ownerId: "ada" });
			yield* record("Membership", "findMany", [{ ownerId: "eve", memberId: "fay" }]);
			yield* record("AuditNote", "create", { id: "n1" });
			yield* record("Invoice", "create", { ownerId: "ada" });
			expect(published).toEqual([
				["ada", "bob"],
				["ada", "cyd", "dan"],
			]);
			expect(unnamed).toEqual([
				{ model: "Membership", operation: "deleteMany", reason: "countOnly" },
				{ model: "Membership", operation: "update", reason: "narrowed", field: "memberId" },
			]);
		}),
	));
