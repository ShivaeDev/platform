import { inspect } from "node:util";
import { Cause, Context, ErrorReporter, Exit, Schema } from "effect";
import { Conflict, InternalServerError, ServiceUnavailable } from "#taxonomy.ts";

export const Rejection = Schema.Union([Conflict, InternalServerError, ServiceUnavailable]);

function fault(reason: Cause.Reason<unknown>): unknown[] {
	if (Cause.isFailReason(reason)) {
		return [reason.error];
	}
	if (Cause.isDieReason(reason)) {
		return [reason.defect];
	}
	return [];
}

export function observe(exit: Exit.Exit<string, unknown> | undefined) {
	if (exit === undefined) {
		throw new Error("Run a request before reading its answer");
	}
	if (Exit.isSuccess(exit)) {
		return { answer: exit.value, cancelled: false, retainedFaults: [], wire: exit.value };
	}
	const rejection = exit.cause.reasons.find(Cause.isFailReason)?.error;
	const original = rejection instanceof InternalServerError || rejection instanceof ServiceUnavailable ? rejection.cause : undefined;
	return {
		answer: rejection ?? "cancelled",
		cancelled: Cause.hasInterrupts(exit.cause),
		retainedFaults: Cause.isCause(original) ? original.reasons.flatMap(fault) : [],
		wire: Schema.is(Rejection)(rejection) ? JSON.parse(JSON.stringify(rejection)) : undefined,
	};
}

export function recordingReporter() {
	const reports: {
		readonly failures: readonly unknown[];
		readonly defects: readonly unknown[];
		readonly cancelled: boolean;
		readonly requestDetails: readonly unknown[];
		readonly text: string;
	}[] = [];
	const reporter: ErrorReporter.ErrorReporter = {
		[ErrorReporter.TypeId]: ErrorReporter.TypeId,
		report: ({ cause }) => {
			reports.push({
				cancelled: Cause.hasInterrupts(cause),
				defects: cause.reasons.flatMap((reason) => (Cause.isDieReason(reason) ? [reason.defect] : [])),
				failures: cause.reasons.flatMap((reason) => (Cause.isFailReason(reason) ? [reason.error] : [])),
				requestDetails: cause.reasons.map((reason) => Context.getOrUndefined(Cause.reasonAnnotations(reason), RequestDetails)),
				text: inspect(cause, { depth: null }),
			});
		},
	};
	return { reporter, reports };
}

export class RequestDetails extends Context.Service<RequestDetails, { readonly password: string }>()("errors/test/RequestDetails") {}
