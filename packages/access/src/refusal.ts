import { Forbidden, Unauthorized } from "@shivaedev/errors/taxonomy.ts";
import type { Permission } from "./permission.ts";

export function forbidden(permission: Permission): Forbidden {
	return new Forbidden({ message: `Permission required: ${permission.name} (${permission.strength})` });
}

export function unauthorized(): Unauthorized {
	return new Unauthorized({ message: "Sign in to continue" });
}
