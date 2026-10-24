import { Effect, Schema } from "effect";
import { contract } from "@shivaedev/effect-contract/contract.ts";
import { command, query } from "@shivaedev/effect-contract/operation.ts";
import { AttentionOwner } from "#attention.ts";
import { views } from "#engine/views.ts";
import { fleetRejections } from "#errors.ts";
import { exposeFailure } from "#exposeFailure.ts";
import { Fleet } from "#fleet.ts";
import { fleetRecords as recordKeys } from "#fleetRecords.ts";
import { FleetRecord, FleetViews } from "#model.ts";
import { Preparation } from "#preparation/schema.ts";
import { LaunchSettings } from "#session/schema.ts";
export const fleetRecords = recordKeys;
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
export const Resolve = command("resolve", {
	invalidates: ({ workId }) => [fleetRecords.list, fleetRecords.item(workId)],
	payload: { decisionId: Schema.String, responseId: Schema.String, workId: Schema.String },
	rejections,
	success: FleetRecord,
});
export const Get = query("get", {
	payload: { workId: Schema.String },
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
export const Views = query("views", { reads: () => [fleetRecords.list], rejections, success: FleetViews });
export const FleetContract = contract("fleet", { commands: [Prepare, Dispatch, Continue, Reconcile, Resolve, Reassign], queries: [Views, Get] });

export const fleetHandlers = FleetContract.application.toLayer(
	Effect.gen(function* () {
		const fleet = yield* Fleet;
		return FleetContract.application.of({
			"fleet.continue": ({ workId, message }) => exposeFailure(fleet.continue(workId, message).pipe(Effect.map(({ value }) => value))),
			"fleet.dispatch": ({ workId }) => exposeFailure(fleet.dispatch(workId).pipe(Effect.map(({ value }) => value))),
			"fleet.get": ({ workId }) => exposeFailure(fleet.get(workId).pipe(Effect.map(({ value }) => value))),
			"fleet.prepare": (input) => exposeFailure(fleet.prepare(input).pipe(Effect.map(({ value }) => value))),
			"fleet.reassign": ({ workId, decisionId, attentionOwner }) =>
				exposeFailure(fleet.reassign(workId, decisionId, attentionOwner).pipe(Effect.map(({ value }) => value))),
			"fleet.reconcile": ({ workId }) => exposeFailure(fleet.reconcile(workId).pipe(Effect.map(({ value }) => value))),
			"fleet.resolve": ({ workId, decisionId, responseId }) =>
				exposeFailure(fleet.resolve(workId, decisionId, responseId).pipe(Effect.map(({ value }) => value))),
			"fleet.views": () => exposeFailure(fleet.list().pipe(Effect.map((records) => views(records.map(({ value }) => value))))),
		});
	}),
);
