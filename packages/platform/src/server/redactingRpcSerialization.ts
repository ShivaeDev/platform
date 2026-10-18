import { Predicate } from "effect";
import type { RpcSerialization } from "effect/rpc";
import { redact } from "#server/rpc-server/redact.ts";
import type { SensitiveKey } from "#server/rpc-server/sensitive.ts";

export function redactingRpcSerialization(wire: RpcSerialization.RpcSerialization["Service"], sensitive: SensitiveKey): typeof wire {
	function reason(value: unknown): unknown {
		const redacted = redact(value, sensitive);
		if (
			(Predicate.isTagged(value, "Fail") || Predicate.isTagged(value, "Die") || Predicate.isTagged(value, "Interrupt"))
			&& Predicate.isObjectOrArray(redacted)
		) {
			return { ...redacted, _tag: value._tag };
		}
		return redacted;
	}
	function response(value: unknown): unknown {
		if (Array.isArray(value)) {
			return value.map(response);
		}
		if (Predicate.isTagged(value, "Defect") && Predicate.hasProperty(value, "defect")) {
			return { ...value, defect: redact(value.defect, sensitive) };
		}
		if (
			Predicate.isTagged(value, "Exit")
			&& Predicate.hasProperty(value, "exit")
			&& Predicate.isTagged(value.exit, "Failure")
			&& Predicate.hasProperty(value.exit, "cause")
		) {
			const cause = Array.isArray(value.exit.cause) ? value.exit.cause.map(reason) : redact(value.exit.cause, sensitive);
			return { ...value, exit: { ...value.exit, cause } };
		}
		return value;
	}
	return {
		...wire,
		makeUnsafe: () => {
			const parser = wire.makeUnsafe();
			return { ...parser, encode: (value) => parser.encode(response(value)) };
		},
	};
}
