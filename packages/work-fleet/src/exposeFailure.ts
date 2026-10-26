import { Effect } from "effect";
import { Conflict, Forbidden, ServiceUnavailable } from "@shivaedev/contract/errors/taxonomy.ts";
import { rpcBoundary } from "@shivaedev/platform/server/rpc-server/boundary.ts";
import { failureMessage } from "#engine/failureMessage.ts";
import { FleetError, isFleetError } from "#errors.ts";
import { StorageAdmission, StorageCapacity, StorageConflict, StorageQuota } from "#storage/errors.ts";

function rejection(error: unknown): FleetError {
	if (isFleetError(error)) {
		return error;
	}
	const message = failureMessage(error);
	if (error instanceof StorageConflict) {
		return new Conflict({ message });
	}
	if (error instanceof StorageAdmission || error instanceof StorageCapacity || error instanceof StorageQuota) {
		return new Forbidden({ message });
	}
	return new ServiceUnavailable({ message });
}

export function exposeFailure<A, E, R>(effect: Effect.Effect<A, E, R>) {
	return effect.pipe(
		Effect.mapError(rejection),
		rpcBoundary(FleetError, {
			message: "The integration is unavailable; inspect runtime diagnostics",
			unexpected: (message) => new ServiceUnavailable({ message }),
		}),
	);
}
