import { Effect, Predicate } from "effect";

function field(error: object, name: string): string {
	return Predicate.hasProperty(error, name) ? String(error[name]) : "";
}

export function refusal(error: unknown, jobName: (id: string) => string = (id) => id): string {
	if (!Predicate.hasProperty(error, "_tag")) {
		return `untagged failure ${JSON.stringify(error)}`;
	}
	switch (error._tag) {
		case "Unauthorized":
			return "unauthorized";
		case "Forbidden":
			return "forbidden";
		case "BadRequest":
			return "bad input";
		case "NotFound":
			return "not found";
		case "LastRoleAssigner":
			return `${field(error, "userId")} is the last role assigner`;
		case "JobsQueueUnregistered":
			return `${field(error, "queue")} is not a registered queue`;
		case "JobsNotFailed":
			return `${jobName(field(error, "id"))} is not a failed ${field(error, "queue")} job`;
		case "JobsPayloadInvalid":
			return `${field(error, "queue")} holds an invalid payload`;
		case "JobsUnavailable":
			return `jobs unavailable for ${field(error, "operation")}`;
		default:
			return `untranslated ${String(error._tag)}`;
	}
}

export function answered<A, E, R>(effect: Effect.Effect<A, E, R>, jobName?: (id: string) => string): Effect.Effect<A | string, never, R> {
	return Effect.catch(effect, (error) => Effect.succeed(refusal(error, jobName)));
}
