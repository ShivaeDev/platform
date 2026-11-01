import { type Context, Effect, Schema } from "effect";
import { GitHub, write } from "#GitHub.ts";
import type { appServer } from "./appServer.ts";

export function mutationAppVerbs(
	context: Context.Context<Context.Service.Identifier<typeof GitHub>>,
	server: Effect.Success<typeof appServer>["server"],
	attempt: <A, E>(line: string, effect: Effect.Effect<A, E>) => Effect.Effect<A | string>,
	credentialOf: (authorization: string | undefined) => string,
) {
	return {
		mutationBudgets: () => Effect.flatMap(GitHub, (client) => client.observations()).pipe(Effect.provide(context)),
		mutationRequests: () =>
			Effect.sync(() =>
				server.requests
					.filter(({ method }) => method === "PUT" || method === "DELETE")
					.map(({ method, path, body, headers, status }) => ({
						body: body.toString(),
						credential: credentialOf(headers.authorization),
						method,
						path,
						status,
					})),
			),
		writeMutation: (method: "PUT" | "DELETE", path: string, body?: unknown, json = false) => {
			const line = `the background client sends ${method} ${path}`;
			if (json) {
				return attempt(line, write(method, path, body, Schema.Array(Schema.Struct({ name: Schema.String }))).pipe(Effect.provide(context)));
			}
			return attempt(line, write(method, path, body).pipe(Effect.provide(context)));
		},
	};
}
