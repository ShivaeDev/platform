import { Predicate } from "effect";
import type { RpcSerialization } from "effect/rpc";
import { redactWire } from "#server/rpc-server/redact.ts";
import { REDACTED, type SensitiveKey } from "#server/rpc-server/sensitive.ts";

function isRequestId(value: unknown): value is string | number {
	return typeof value === "string" || typeof value === "number";
}
export function redactingRpcSerialization(
	wire: RpcSerialization.RpcSerialization["Service"],
	sensitive: SensitiveKey,
	maskFailure: (tag: string | undefined, reason: "Fail" | "Die") => boolean = () => false,
): typeof wire {
	function reason(value: unknown, tag: string | undefined): unknown {
		const redacted = redactWire(value, sensitive);
		if (Predicate.isObjectOrArray(redacted)) {
			if (Predicate.isTagged(value, "Fail") && maskFailure(tag, "Fail")) {
				return { ...redacted, _tag: "Fail", error: REDACTED };
			}
			if (Predicate.isTagged(value, "Die") && maskFailure(tag, "Die")) {
				return { ...redacted, _tag: "Die", defect: REDACTED };
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
			const cause = Array.isArray(value.cause) ? value.cause.map((item) => reason(item, tag)) : redactWire(value.cause, sensitive);
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
					return { ...value, defect: maskFailure(undefined, "Die") ? REDACTED : redactWire(value.defect, sensitive) };
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
				decode: (data) => {
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
				encode: (value) => parser.encode(response(value)),
			};
		},
	};
}
