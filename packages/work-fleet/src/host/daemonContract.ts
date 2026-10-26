import { Schema } from "effect";
import { contract } from "@shivaedev/effect-contract/contract.ts";
import { command, query, stream } from "@shivaedev/effect-contract/operation.ts";
import { diagnostics as diagnosticsApi } from "@shivaedev/work-board/server/integration/diagnostics.ts";
import { ClosedDecision } from "#board/schema.ts";
import { DispatchRequest } from "#DispatchRequest.ts";
import { fleetRejections } from "#errors.ts";
import { DaemonStatus } from "#host/configSettings.ts";
import { WatchSnapshot } from "#host/watchState.ts";
import { FleetRecord } from "#model.ts";
import { FleetContract, fleetRecords } from "#operations.ts";

const { DAEMON_RPC_PATH, DiagnosticsContract } = diagnosticsApi;

export const ClientContract = contract("daemon", {
	commands: [
		command("check-stuck", {
			invalidates: ({ workId }) => [fleetRecords.list, fleetRecords.item(workId)],
			payload: { workId: Schema.String },
			rejections: fleetRejections,
			success: Schema.Boolean,
		}),
		command("close-finished-decisions", {
			invalidates: () => [fleetRecords.list],
			payload: { dryRun: Schema.Boolean },
			rejections: fleetRejections,
			success: Schema.Array(ClosedDecision),
		}),
		command("reserve-pr", {
			invalidates: () => [fleetRecords.list],
			payload: { areas: Schema.Array(Schema.String), pr: Schema.String },
			rejections: fleetRejections,
			success: Schema.Void,
		}),
		command("release", {
			invalidates: ({ workIds }) => [fleetRecords.list, ...workIds.map(fleetRecords.item)],
			payload: { workIds: Schema.Array(Schema.String) },
			rejections: fleetRejections,
			success: Schema.Array(FleetRecord),
		}),
		command("answer", {
			invalidates: ({ workId }) => [fleetRecords.list, fleetRecords.item(workId)],
			payload: { release: Schema.optional(Schema.Boolean), text: Schema.optional(Schema.String), workId: Schema.String },
			rejections: fleetRejections,
			success: FleetRecord,
		}),
		command("name-threads", {
			invalidates: () => [],
			payload: {},
			rejections: fleetRejections,
			success: Schema.Array(Schema.Struct({ error: Schema.Boolean, message: Schema.String })),
		}),
		command("dispatch", {
			invalidates: ({ workId }) => [fleetRecords.list, fleetRecords.item(workId)],
			payload: { ignoreAreas: Schema.optional(Schema.Boolean), now: Schema.optional(Schema.Boolean), workId: Schema.String },
			rejections: fleetRejections,
			success: DispatchRequest,
		}),
	],
	queries: [
		query("dispatch-status", {
			payload: { workId: Schema.String },
			reads: ({ workId }) => [fleetRecords.item(workId)],
			rejections: fleetRejections,
			success: Schema.NullOr(DispatchRequest),
		}),
		query("status", {
			payload: { workId: Schema.optional(Schema.String) },
			reads: ({ workId }) => [workId === undefined ? fleetRecords.list : fleetRecords.item(workId)],
			rejections: fleetRejections,
			success: DaemonStatus,
		}),
	],
	streams: [
		stream("watch", {
			payload: { workIds: Schema.Array(Schema.String) },
			reads: () => [fleetRecords.list],
			rejections: fleetRejections,
			success: WatchSnapshot,
		}),
		stream("follow", {
			payload: { follow: Schema.optional(Schema.Boolean), workIds: Schema.Array(Schema.String) },
			reads: ({ workIds }) => [fleetRecords.list, ...workIds.map(fleetRecords.item)],
			rejections: fleetRejections,
			success: Schema.Array(Schema.Unknown),
		}),
	],
});
export const Follow = (() => {
	const rpc = [...ClientContract.requests.values()].find((request) => request._tag === "daemon.follow");
	if (rpc === undefined) {
		throw new Error("Daemon contract must declare its follow stream");
	}
	return rpc;
})();
export const DaemonContract = FleetContract.merge(ClientContract, DiagnosticsContract);
export const RPC_PATH = DAEMON_RPC_PATH;
