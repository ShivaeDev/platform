import { Schema } from "effect";
import { Rpc } from "effect/unstable/rpc";
import { contract } from "@shivaedev/effect-contract/contract.ts";
import { command, query } from "@shivaedev/effect-contract/operation.ts";
import { RequestTracing } from "@shivaedev/platform/rpc/middleware.ts";
import { diagnostics as diagnosticsApi } from "@shivaedev/work-board/integration/diagnostics.ts";
import { FleetError, fleetRejections } from "#errors.ts";
import { State } from "#host/waitOutcome.ts";
import { FleetRecord, FleetViews } from "#model.ts";
import { FleetContract, fleetRecords } from "#operations.ts";

const { DAEMON_RPC_PATH, DiagnosticsContract } = diagnosticsApi;

const clientContract = contract("daemon", {
	commands: [
		command("release", {
			invalidates: ({ workIds }) => [fleetRecords.list, ...workIds.map(fleetRecords.item)],
			payload: { workIds: Schema.Array(Schema.String) },
			rejections: fleetRejections,
			success: Schema.Array(FleetRecord),
		}),
		command("decide", {
			invalidates: ({ workId }) => [fleetRecords.list, fleetRecords.item(workId)],
			payload: { action: Schema.Literals(["retry", "release"]), workId: Schema.String },
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
			payload: { workId: Schema.String },
			rejections: fleetRejections,
			success: FleetRecord,
		}),
	],
	queries: [
		query("status", {
			payload: { workId: Schema.optional(Schema.String) },
			reads: ({ workId }) => [workId === undefined ? fleetRecords.list : fleetRecords.item(workId)],
			rejections: fleetRejections,
			success: FleetViews,
		}),
	],
});
export const Follow = Rpc.make("daemon.follow", {
	error: FleetError,
	payload: { workIds: Schema.Array(Schema.String) },
	stream: true,
	success: Schema.Array(State),
});
export const ClientContract = clientContract.add(Follow);
export const DaemonContract = FleetContract.merge(ClientContract, DiagnosticsContract).middleware(RequestTracing);
export const RPC_PATH = DAEMON_RPC_PATH;
