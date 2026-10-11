import { Schema } from "effect";
import { Rpc } from "effect/unstable/rpc";
import { contract } from "@shivaedev/effect-contract/contract.ts";
import { command, query } from "@shivaedev/effect-contract/operation.ts";
import { RequestTracing } from "@shivaedev/platform/rpc/middleware.ts";
import { DAEMON_RPC_PATH, DiagnosticsContract } from "@shivaedev/work-board/diagnostics/daemonContract.ts";
import { State } from "#host/waitOutcome.ts";
import { FleetRecord, FleetViews } from "#model.ts";
import { FleetContract, fleetRecords } from "#operations.ts";
import { FleetFailure } from "#policy.ts";

const clientContract = contract("daemon", {
	commands: [
		command("dispatch", {
			invalidates: ({ workId }) => [fleetRecords.list, fleetRecords.item(workId)],
			payload: { workId: Schema.String },
			rejections: { FleetFailure },
			success: FleetRecord,
		}),
	],
	queries: [
		query("status", {
			payload: { workId: Schema.optional(Schema.String) },
			reads: ({ workId }) => [workId === undefined ? fleetRecords.list : fleetRecords.item(workId)],
			rejections: { FleetFailure },
			success: FleetViews,
		}),
	],
});
export const Follow = Rpc.make("daemon.follow", {
	error: FleetFailure,
	payload: { workIds: Schema.Array(Schema.String) },
	stream: true,
	success: Schema.Array(State),
});
export const ClientContract = clientContract.add(Follow);
export const DaemonContract = FleetContract.merge(ClientContract, DiagnosticsContract).middleware(RequestTracing);
export const RPC_PATH = DAEMON_RPC_PATH;
