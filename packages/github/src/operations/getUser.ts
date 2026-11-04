import { Effect } from "effect";
import { User } from "#repositorySchemas.ts";
import type { Representations } from "#representations.ts";

export function getUser(client: Representations) {
	return (username?: string, byteLimit?: number) =>
		Effect.flatMap(client.read(username === undefined ? "/user" : `/users/${encodeURIComponent(username)}`, byteLimit), (page) => page.decode(User));
}
