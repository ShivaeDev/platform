import { bind, collection, command, contract, fieldRejection, query } from "@shivaedev/effect-contract";
import { Context, Deferred, Effect, Layer, Schema } from "effect";
import * as AtomRpc from "effect/unstable/reactivity/AtomRpc";
import { RpcMiddleware, RpcTest } from "effect/unstable/rpc";

export class InvoiceLine extends Schema.Class<InvoiceLine>("InvoiceLine")({
	id: Schema.Number,
	name: Schema.String,
	quantity: Schema.Number,
}) {}
export const InvoiceLineDraft = Schema.Struct({ name: InvoiceLine.fields.name, quantity: InvoiceLine.fields.quantity });
export class Unavailable extends Schema.TaggedError<Unavailable>()("Unavailable", {}) {}
export class Unauthorized extends Schema.TaggedError<Unauthorized>()("Unauthorized", {}) {}
class Principal extends Context.Service<Principal, { readonly user: string }>()("invoice/Principal") {}
class Guard extends RpcMiddleware.Service<Guard, { provides: Principal }>()("invoice/Guard", { error: Unauthorized }) {}

const invoiceLines = collection("invoiceLines", InvoiceLine.fields.id);
const GetInvoiceLine = query("get", {
	payload: { id: Schema.Number },
	reads: ({ id }) => [invoiceLines.item(id)],
	rejections: { InvoiceLineNotFound: {}, Unavailable },
	success: InvoiceLine,
});
const SaveInvoiceLine = command("save", {
	invalidates: ({ id }) => [invoiceLines.item(id)],
	payload: { id: Schema.Number, ...InvoiceLineDraft.fields },
	rejections: { InvoiceLineRejected: fieldRejection(InvoiceLineDraft), Unavailable },
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
	saves: number;
}

export const makeInvoiceLineServer = (initial: ReadonlyArray<InvoiceLine>) => {
	const store = new Map(initial.map((line) => [line.id, line]));
	const control: Control = { gets: 0, held: undefined, mode: "ok", saves: 0 };
	const hold = () => {
		const gate = Effect.runSync(Deferred.make<void>());
		control.held = gate;
		return () => Effect.runSync(Deferred.succeed(gate, undefined));
	};
	const admitted = Effect.suspend((): Effect.Effect<void, Unavailable> => {
		const gate = control.held;
		control.held = undefined;
		if (control.mode === "unavailable") return Effect.fail(new Unavailable());
		return gate === undefined ? Effect.void : Deferred.await(gate);
	});
	const normalized = (
		draft: typeof InvoiceLineDraft.Type,
	): Effect.Effect<typeof InvoiceLineDraft.Type, { readonly field: "name" | "quantity"; readonly message: string }> => {
		const name = draft.name.trim();
		if (name.length > 20) return Effect.fail({ field: "name", message: "Name is too long" });
		if (draft.quantity > 5000) return Effect.fail({ field: "quantity", message: "Quantity is too large" });
		return Effect.succeed({ name: name.charAt(0).toUpperCase() + name.slice(1), quantity: draft.quantity });
	};
	const stored = (line: InvoiceLine) => Effect.sync(() => store.set(line.id, line)).pipe(Effect.as(line));
	const counted = Effect.sync(() => {
		control.saves += 1;
	}).pipe(Effect.andThen(admitted));
	const handlers = InvoiceLines.toLayer({
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
		"invoiceLines.save": ({ id, ...draft }) =>
			counted.pipe(
				Effect.andThen(normalized(draft).pipe(Effect.catch((rejection) => SaveInvoiceLine.reject.InvoiceLineRejected(rejection)))),
				Effect.flatMap((values) => stored(new InvoiceLine({ id, ...values }))),
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
	const api = bind(InvoiceLines, Client);
	const edit = (line: InvoiceLine) => store.set(line.id, line);
	return { api, control, edit, hold, runtime: Client.runtime, stored: (id: number) => store.get(id) };
};
