import { Cause, Exit } from "effect";
import { PrismaError } from "#error.ts";

export function publicFailure<A, E>(exit: Exit.Exit<A, E>): PrismaError {
	if (Exit.isFailure(exit)) {
		for (const reason of exit.cause.reasons) {
			if (Cause.isFailReason(reason) && reason.error instanceof PrismaError) {
				return reason.error;
			}
			if (Cause.isDieReason(reason) && reason.defect instanceof PrismaError) {
				return reason.defect;
			}
		}
	}
	throw new Error(`Expected a public PrismaError, received ${JSON.stringify(exit)}`);
}
