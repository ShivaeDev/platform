import { Effect, Schema } from "effect";
import { contract } from "@shivaedev/contract/contract.ts";
import { command, query } from "@shivaedev/contract/operation.ts";
import { rpcBoundary } from "@shivaedev/errors/boundary.ts";
import { ServiceUnavailable } from "@shivaedev/errors/taxonomy.ts";
import { AttentionOwner } from "#attention.ts";
import { views } from "#engine/views.ts";
import { FleetError, fleetRejections } from "#errors.ts";
import { exposeFailure as mapFailure } from "#exposeFailure.ts";
import { Fleet } from "#fleet.ts";
import { fleetRecords } from "#fleetRecords.ts";
import { FleetRecord, FleetViews } from "#model.ts";
import { Preparation } from "#preparation/schema.ts";
import { LaunchSettings } from "#session/schema.ts";

const rejections = fleetRejections;
export const Prepare = command("prepare", {
	invalidates: ({ workId }) => [fleetRecords.list, fleetRecords.item(workId)],
	payload: { cwd: Schema.String, launch: Schema.optional(LaunchSettings), preparation: Preparation, prompt: Schema.String, workId: Schema.String },
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
export const Continue = command("continue", {
	invalidates: ({ workId }) => [fleetRecords.list, fleetRecords.item(workId)],
	payload: { message: Schema.String, workId: Schema.String },
	rejections,
	success: FleetRecord,
});
export const ReleaseCi = command("release-ci", {
	invalidates: ({ workId }) => [fleetRecords.list, fleetRecords.item(workId)],
	payload: { head: Schema.String, workId: Schema.String },
	rejections,
	success: FleetRecord,
});
export const Resolve = command("resolve", {
	invalidates: ({ workId }) => [fleetRecords.list, fleetRecords.item(workId)],
	payload: { decisionId: Schema.String, responseId: Schema.String, workId: Schema.String },
	rejections,
	success: FleetRecord,
});
export const Get = query("get", {
	payload: { workId: Schema.String },
	readPolicy: () => Effect.succeed(true),
	reads: ({ workId }) => [fleetRecords.item(workId)],
	rejections,
	success: FleetRecord,
});
export const Reassign = command("reassign", {
	invalidates: ({ workId }) => [fleetRecords.list, fleetRecords.item(workId)],
	payload: { attentionOwner: AttentionOwner, decisionId: Schema.String, workId: Schema.String },
	rejections,
	success: FleetRecord,
});
export const Views = query("views", { readPolicy: () => Effect.succeed(true), reads: () => [fleetRecords.list], rejections, success: FleetViews });
export const FleetContract = contract("fleet", {
	commands: [Prepare, Dispatch, Continue, Reconcile, Resolve, Reassign, ReleaseCi],
	queries: [Views, Get],
});

export function fleetFailure<A, E, R>(effect: Effect.Effect<A, E, R>) {
	return mapFailure(effect).pipe(
		rpcBoundary(FleetError, {
			message: "The integration is unavailable; inspect runtime diagnostics",
			unexpected: (message) => new ServiceUnavailable({ message }),
		}),
	);
}

export const fleetHandlers = FleetContract.application.toLayer(
	Effect.gen(function* () {
		const fleet = yield* Fleet;
		return FleetContract.application.of({
			"fleet.continue": ({ workId, message }) => fleetFailure(fleet.continue(workId, message).pipe(Effect.map(({ value }) => value))),
			"fleet.dispatch": ({ workId }) => fleetFailure(fleet.dispatch(workId).pipe(Effect.map(({ value }) => value))),
			"fleet.get": ({ workId }) => fleetFailure(fleet.get(workId).pipe(Effect.map(({ value }) => value))),
			"fleet.prepare": (input) => fleetFailure(fleet.prepare(input).pipe(Effect.map(({ value }) => value))),
			"fleet.reassign": ({ workId, decisionId, attentionOwner }) =>
				fleetFailure(fleet.reassign(workId, decisionId, attentionOwner).pipe(Effect.map(({ value }) => value))),
			"fleet.reconcile": ({ workId }) => fleetFailure(fleet.reconcile(workId).pipe(Effect.map(({ value }) => value))),
			"fleet.release-ci": ({ workId, head }) => fleetFailure(fleet.releaseCi(workId, head).pipe(Effect.map(({ value }) => value))),
			"fleet.resolve": ({ workId, decisionId, responseId }) =>
				fleetFailure(fleet.resolve(workId, decisionId, responseId).pipe(Effect.map(({ value }) => value))),
			"fleet.views": () => fleetFailure(fleet.list().pipe(Effect.map((records) => views(records.map(({ value }) => value))))),
		});
	}),
);
