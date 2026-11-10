import type { Schema } from "effect";
import { ServiceUnavailable } from "#taxonomy.ts";

export interface Retryable {
	readonly isRetryable: boolean;
}
export type InfrastructureFailure = Retryable | Schema.SchemaError;

export function infrastructureRejection(failure: unknown): ServiceUnavailable | undefined {
	if (typeof failure !== "object" || failure === null || Reflect.get(failure, "isRetryable") !== true) {
		return undefined;
	}
	const rejection = new ServiceUnavailable({ message: "The service is unavailable. Try again later." });
	Object.defineProperty(rejection, "cause", { configurable: true, enumerable: false, value: failure });
	return rejection;
}
