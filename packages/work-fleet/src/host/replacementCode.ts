import { Effect } from "effect";
import { logSupervisor, type startProcess } from "./supervisedProcess.ts";
import { codeReader, type RunningCode } from "./supervisorCode.ts";

export const replacementCode = Effect.fn("FleetSupervisor.replacementCode")(function* (
	name: "board" | "daemon",
	child: Effect.Success<ReturnType<typeof startProcess>>,
	code: RunningCode,
	root: string,
	log: string,
) {
	const exit = child.exit();
	if (exit !== undefined) {
		return { code: { ...(yield* codeReader(root))[name], revision: code.revision }, reason: `exited unexpectedly: ${exit}` };
	}
	const check = yield* child.checkCode;
	if (check === undefined) {
		return undefined;
	}
	if (!check.changed) {
		yield* logSupervisor(log, `checked ${name} pid ${child.pid} loaded code`);
		return undefined;
	}
	return {
		code: { ...(yield* codeReader(root))[name], revision: check.revision },
		reason: `code changed to ${check.revision}; draining requests`,
	};
});
