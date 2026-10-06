import { Effect, Schema } from "effect";
import { contract } from "@shivaedev/effect-contract/contract.ts";
import { collection } from "@shivaedev/effect-contract/keys.ts";
import { command, query } from "@shivaedev/effect-contract/operation.ts";
import { failureMessage } from "#engine/failureMessage.ts";
import { views } from "#engine/views.ts";
import { Fleet } from "#fleet.ts";
import { FleetRecord, FleetViews } from "#model.ts";
import { FleetFailure } from "#policy.ts";
import { Preparation } from "#preparation/schema.ts";
export const fleetRecords = collection("fleet", Schema.String);
const rejections = { FleetFailure };
export const Prepare = command("prepare", {
	invalidates: ({ workId }) => [fleetRecords.list, fleetRecords.item(workId)],
	payload: { cwd: Schema.String, preparation: Preparation, prompt: Schema.String, workId: Schema.String },
	rejections,
	success: FleetRecord,
});
export const Dispatch = command("dispatch", {
	invalidates: ({ workId }) => [fleetRecords.list, fleetRecords.item(workId)],
	payload: { workId: Schema.String },
	rejections,
	success: FleetRecord,
});
export const Reconcile = command("reconcile", {
	invalidates: ({ workId }) => [fleetRecords.list, fleetRecords.item(workId)],
	payload: { workId: Schema.String },
	rejections,
	success: FleetRecord,
});
export const Resolve = command("resolve", {
	invalidates: ({ workId }) => [fleetRecords.list, fleetRecords.item(workId)],
	payload: { action: Schema.Literals(["retry", "release"]), decisionId: Schema.String, workId: Schema.String },
	rejections,
	success: FleetRecord,
});
export const Get = query("get", {
	payload: { workId: Schema.String },
	reads: ({ workId }) => [fleetRecords.item(workId)],
	rejections,
	success: FleetRecord,
});
export const Views = query("views", { reads: () => [fleetRecords.list], rejections, success: FleetViews });
export const FleetContract = contract("fleet", { commands: [Prepare, Dispatch, Reconcile, Resolve], queries: [Views, Get] });
function expose<A, E>(effect: Effect.Effect<A, E>) {
	return effect.pipe(
		Effect.mapError((error) => (error instanceof FleetFailure ? error : new FleetFailure({ message: failureMessage(error), reason: "integration" }))),
	);
}
export const fleetHandlers = FleetContract.toLayer(
	Effect.gen(function* () {
		const fleet = yield* Fleet;
		return FleetContract.of({
			"fleet.dispatch": ({ workId }) => expose(fleet.dispatch(workId).pipe(Effect.map(({ value }) => value))),
			"fleet.get": ({ workId }) => expose(fleet.get(workId).pipe(Effect.map(({ value }) => value))),
			"fleet.prepare": (input) => expose(fleet.prepare(input).pipe(Effect.map(({ value }) => value))),
			"fleet.reconcile": ({ workId }) => expose(fleet.reconcile(workId).pipe(Effect.map(({ value }) => value))),
			"fleet.resolve": ({ workId, decisionId, action }) => expose(fleet.resolve(workId, decisionId, action).pipe(Effect.map(({ value }) => value))),
			"fleet.views": () => expose(fleet.list().pipe(Effect.map((records) => views(records.map(({ value }) => value))))),
		});
	}),
);
