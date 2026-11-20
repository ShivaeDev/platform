import { Data } from "effect";
import { Forbidden, Unauthorized } from "@shivaedev/errors/taxonomy.ts";
import type { Permission } from "#permission.ts";

export class MissingPermission extends Data.TaggedError("MissingPermission")<{ readonly message: string; readonly permission: Permission }> {}

// The message reaches the person verbatim, so the permission they lack travels as the cause, which logs print and the wire leaves out.
export function forbidden(permission: Permission): Forbidden {
	const rejection = new Forbidden({ message: "You do not have permission to do this." });
	const missing = new MissingPermission({ message: `Permission required: ${permission.name} (${permission.strength})`, permission });
	Object.defineProperty(rejection, "cause", { configurable: true, value: missing, writable: true });
	return rejection;
}

export function unauthorized(): Unauthorized {
	return new Unauthorized({ message: "Sign in to continue" });
}
