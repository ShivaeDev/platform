import { Context, Deferred, Effect, Layer, Schema, Stream } from "effect";
import * as AtomRpc from "effect/reactivity/AtomRpc";
import { RpcMiddleware, RpcTest } from "effect/rpc";
import { collection } from "@shivaedev/changes/keys.ts";
import { bind } from "@shivaedev/contract/bind.ts";
import { contract } from "@shivaedev/contract/contract.ts";
import { command, query } from "@shivaedev/contract/operation.ts";
import { fieldRejection } from "@shivaedev/contract/rejection.ts";

export class InvoiceLine extends Schema.Class<InvoiceLine>("InvoiceLine")({
	id: Schema.Number,
	name: Schema.String,
	quantity: Schema.Number,
	version: Schema.Number.pipe(Schema.withConstructorDefault(Effect.succeed(1))),
}) {}
export const InvoiceLineDraft = Schema.Struct({ name: InvoiceLine.fields.name, quantity: InvoiceLine.fields.quantity });
export class Unavailable extends Schema.TaggedError<Unavailable>()("Unavailable", {}) {}
export class Unauthorized extends Schema.TaggedError<Unauthorized>()("Unauthorized", {}) {}
class Principal extends Context.Service<Principal, { readonly user: string }>()("invoice/Principal") {}
class Guard extends RpcMiddleware.Service<Guard, { provides: Principal }>()("invoice/Guard", { error: Unauthorized }) {}

const invoiceLines = collection("invoiceLines", InvoiceLine.fields.id);
const GetInvoiceLine = query("get", {
	payload: { id: Schema.Number },
	readPolicy: () => Effect.succeed(true),
	reads: ({ id }) => [invoiceLines.item(id)],
	rejections: { InvoiceLineNotFound: {}, Unavailable },
	success: InvoiceLine,
});
const SaveInvoiceLine = command("save", {
	invalidates: ({ id }) => [invoiceLines.item(id)],
	payload: { expectedVersion: Schema.Number, id: Schema.Number, ...InvoiceLineDraft.fields },
	rejections: { Conflict: {}, InvoiceLineNotFound: {}, InvoiceLineRejected: fieldRejection(InvoiceLineDraft), Unavailable },
	success: InvoiceLine,
});
const CreateInvoiceLine = command("create", {
	invalidates: (_draft, line) => [invoiceLines.item(line.id), invoiceLines.list],
	payload: InvoiceLineDraft,
	rejections: { InvoiceLineRejected: fieldRejection(InvoiceLineDraft), Unavailable },
	success: InvoiceLine,
});
export const InvoiceLines = contract("invoiceLines", { commands: [SaveInvoiceLine, CreateInvoiceLine], queries: [GetInvoiceLine] }).middleware(Guard);

interface Control {
	gets: number;
	held: Deferred.Deferred<void> | undefined;
	mode: "ok" | "unavailable" | "unauthorized";
	readonly savedDrafts: Array<typeof InvoiceLineDraft.Type & { readonly id: number; readonly expectedVersion: number }>;
	saves: number;
}

export function makeInvoiceLineServer(initial: readonly InvoiceLine[]) {
	const store = new Map(initial.map((line) => [line.id, line]));
	const control: Control = { gets: 0, held: undefined, mode: "ok", savedDrafts: [], saves: 0 };
	function hold() {
		const gate = Effect.runSync(Deferred.make<void>());
		control.held = gate;
		return () => Effect.runSync(Deferred.succeed(gate, undefined));
	}
	const admitted = Effect.suspend((): Effect.Effect<void, Unavailable> => {
		const gate = control.held;
		control.held = undefined;
		if (control.mode === "unavailable") {
			return Effect.fail(new Unavailable());
		}
		return gate === undefined ? Effect.void : Deferred.await(gate);
	});
	function normalized(
		draft: typeof InvoiceLineDraft.Type,
	): Effect.Effect<typeof InvoiceLineDraft.Type, { readonly field: "name" | "quantity"; readonly message: string }> {
		const name = draft.name.trim();
		if (name.length > 20) {
			return Effect.fail({ field: "name", message: "Name is too long" });
		}
		if (draft.quantity > 5000) {
			return Effect.fail({ field: "quantity", message: "Quantity is too large" });
		}
		return Effect.succeed({ name: name.charAt(0).toUpperCase() + name.slice(1), quantity: draft.quantity });
	}
	function stored(line: InvoiceLine) {
		return Effect.sync(() => store.set(line.id, line)).pipe(Effect.as(line));
	}
	const counted = Effect.sync(() => {
		control.saves += 1;
	}).pipe(Effect.andThen(admitted));
	const handlers = InvoiceLines.toLayer({
		"invoiceLines.$changes": () => Stream.never,
		"invoiceLines.create": (draft) =>
			counted.pipe(
				Effect.andThen(normalized(draft).pipe(Effect.catch((rejection) => CreateInvoiceLine.reject.InvoiceLineRejected(rejection)))),
				Effect.flatMap((values) => stored(new InvoiceLine({ id: store.size + 1, ...values }))),
			),
		"invoiceLines.get": ({ id }) =>
			admitted.pipe(
				Effect.andThen(() => {
					control.gets += 1;
					const line = store.get(id);
					return line === undefined ? GetInvoiceLine.reject.InvoiceLineNotFound() : Effect.succeed(line);
				}),
			),
		"invoiceLines.save": ({ id, expectedVersion, ...draft }) =>
			Effect.sync(() => control.savedDrafts.push({ expectedVersion, id, ...draft })).pipe(
				Effect.andThen(counted),
				Effect.andThen(normalized(draft).pipe(Effect.catch((rejection) => SaveInvoiceLine.reject.InvoiceLineRejected(rejection)))),
				Effect.flatMap((values) =>
					Effect.gen(function* () {
						const current = store.get(id);
						if (!current) {
							return yield* SaveInvoiceLine.reject.InvoiceLineNotFound();
						}
						if (current.version !== expectedVersion) {
							return yield* SaveInvoiceLine.reject.Conflict();
						}
						return yield* stored(new InvoiceLine({ id, ...values, version: current.version + 1 }));
					}),
				),
			),
	});
	const guard = Layer.succeed(Guard, (effect) =>
		Effect.suspend(() =>
			control.mode === "unauthorized" ? Effect.fail(new Unauthorized()) : Effect.provideService(effect, Principal, { user: "ada" }),
		),
	);
	class Client extends AtomRpc.Service<Client>()("test/InvoiceLineClient", {
		group: InvoiceLines,
		makeEffect: RpcTest.makeClient(InvoiceLines, { flatten: true }),
		protocol: Layer.merge(handlers, guard),
	}) {}
	const api = bind(InvoiceLines, Client, { live: false });
	function edit(line: InvoiceLine) {
		return store.set(line.id, line);
	}
	return { api, control, edit, hold, runtime: Client.runtime, stored: (id: number) => store.get(id) };
}
