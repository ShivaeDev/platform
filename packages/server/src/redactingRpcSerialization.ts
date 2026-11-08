import { Effect, Predicate } from "effect";
import { RpcSerialization } from "effect/rpc";
import { redactWire } from "@shivaedev/errors/redact.ts";
import type { schemaSensitiveKeys } from "@shivaedev/errors/schemaSensitiveKeys.ts";
import { REDACTED } from "@shivaedev/errors/sensitive.ts";

function isRequestId(value: unknown): value is string | number {
	return typeof value === "string" || typeof value === "number";
}
export const redactingRpcSerialization = Effect.fnUntraced(function* (sensitive: Effect.Success<ReturnType<typeof schemaSensitiveKeys>>) {
	const wire: RpcSerialization.RpcSerialization["Service"] = yield* RpcSerialization.RpcSerialization;
	function reason(value: unknown, tag: string | undefined): unknown {
		const redacted = redactWire(value, sensitive.forRpc(tag));
		if (Predicate.isObjectOrArray(redacted)) {
			if (Predicate.isTagged(value, "Fail") && Predicate.hasProperty(value, "error")) {
				return { ...redacted, _tag: "Fail", error: sensitive.redactFailure(tag, "Fail", value.error) };
			}
			if (Predicate.isTagged(value, "Die") && Predicate.hasProperty(value, "defect")) {
				return { ...redacted, _tag: "Die", defect: sensitive.redactFailure(tag, "Die", value.defect) };
			}
		}
		if (
			(Predicate.isTagged(value, "Fail") || Predicate.isTagged(value, "Die") || Predicate.isTagged(value, "Interrupt"))
			&& Predicate.isObjectOrArray(redacted)
		) {
			return { ...redacted, _tag: value._tag };
		}
		return redacted;
	}
	function exit(value: unknown, tag: string | undefined): unknown {
		if (Predicate.isTagged(value, "Failure") && Predicate.hasProperty(value, "cause")) {
			const cause = Array.isArray(value.cause) ? value.cause.map((item) => reason(item, tag)) : redactWire(value.cause, sensitive.forRpc(tag));
			return { ...value, cause };
		}
		return value;
	}
	return {
		...wire,
		makeUnsafe: () => {
			const parser = wire.makeUnsafe();
			const requests = new Map<string | number, string>();
			function response(value: unknown): unknown {
				if (Array.isArray(value)) {
					return value.map(response);
				}
				if (Predicate.isTagged(value, "Defect") && Predicate.hasProperty(value, "defect")) {
					return { ...value, defect: sensitive.maskFailure(undefined, "Die") ? REDACTED : redactWire(value.defect, sensitive) };
				}
				if (
					Predicate.isTagged(value, "Exit")
					&& Predicate.hasProperty(value, "requestId")
					&& isRequestId(value.requestId)
					&& Predicate.hasProperty(value, "exit")
				) {
					const tag = requests.get(value.requestId);
					requests.delete(value.requestId);
					return { ...value, exit: exit(value.exit, tag) };
				}
				return value;
			}
			return {
				...parser,
				decode: (data: Uint8Array | string) => {
					const decoded = parser.decode(data);
					for (const request of decoded) {
						if (
							Predicate.isTagged(request, "Request")
							&& Predicate.hasProperty(request, "id")
							&& isRequestId(request.id)
							&& Predicate.hasProperty(request, "tag")
							&& typeof request.tag === "string"
							&& !requests.has(request.id)
						) {
							requests.set(request.id, request.tag);
						}
					}
					return decoded;
				},
				encode: (value: unknown) => parser.encode(response(value)),
			};
		},
	};
});
