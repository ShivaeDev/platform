import type { SessionUserValue } from "#identity.ts";

export function sessionProfile({ id, name, email, role, permissions }: SessionUserValue): SessionUserValue {
	return { email, id, name, ...(role === undefined ? {} : { role }), ...(permissions === undefined ? {} : { permissions }) };
}
