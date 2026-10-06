import { Cause, Exit } from "effect";

export function defectMessage(exit: Exit.Exit<unknown, unknown>): string | undefined {
	const defect = Exit.isFailure(exit) && !Cause.hasFails(exit.cause) ? Cause.squash(exit.cause) : undefined;
	return defect instanceof Error ? defect.message : undefined;
}
