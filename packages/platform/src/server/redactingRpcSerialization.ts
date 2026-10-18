import { Predicate } from "effect";
import type { RpcSerialization } from "effect/rpc";
import { redact } from "#server/rpc-server/redact.ts";
import type { SensitiveKey } from "#server/rpc-server/sensitive.ts";

export function redactingRpcSerialization(wire: RpcSerialization.RpcSerialization["Service"], sensitive: SensitiveKey): typeof wire {
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
			return { ...value, exit: { ...value.exit, cause: redact(value.exit.cause, sensitive) } };
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
