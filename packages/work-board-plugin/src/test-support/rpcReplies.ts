import * as HttpStatus from "effect/http/HttpStatus";
export function success(requestId: string, value: unknown): string {
	return JSON.stringify({ _tag: "Exit", exit: { _tag: "Success", value }, requestId });
}

export function failure(requestId: string, error: unknown): string {
	return JSON.stringify({ _tag: "Exit", exit: { _tag: "Failure", cause: [{ _tag: "Fail", error }] }, requestId });
}

export function reply(...lines: readonly string[]) {
	return { ok: true, status: HttpStatus.fromLiteral("OK"), text: `${lines.join("\n")}\n` };
}
