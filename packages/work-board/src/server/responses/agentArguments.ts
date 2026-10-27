import { Clock, Effect, Schema } from "effect";
import { BadRequest } from "@shivaedev/errors/taxonomy.ts";
import { flags } from "./flags.ts";

const followArguments = Effect.fn("WorkBoard.followArguments")(function* (args: readonly string[]) {
	const [follow, root, option, timestamp, ...extra] = args;
	if (follow !== "--follow" || !root || root.startsWith("--") || extra.length > 0 || (option !== undefined && (option !== "--since" || !timestamp))) {
		return yield* Effect.fail(new BadRequest({ message: "Usage: work-board responses --follow <dir> [--since <ISO timestamp>]" }));
	}
	const since = timestamp === undefined ? yield* Clock.currentTimeMillis : Date.parse(timestamp);
	if (!Number.isFinite(since)) {
		return yield* Effect.fail(new BadRequest({ message: "Use --since with an ISO timestamp, such as 2026-01-01T00:00:00Z." }));
	}
	return { action: "follow", root, since } as const;
});

export const agentArguments = Effect.fn("WorkBoard.agentArguments")(function* (args: readonly string[]) {
	if (args[0] === "responses") {
		return yield* followArguments(args.slice(1));
	}
	const [action, request, ...options] = args;
	if ((action !== "wait" && action !== "response" && action !== "question") || !request) {
		return yield* Effect.fail(
			new BadRequest({
				message: "Usage: work-board question <item>/<request> | wait <question-id> [--after <response-id>] | response <question-id> [--port 4747]",
			}),
		);
	}
	const parsed = yield* Effect.try({
		catch: (cause) =>
			Schema.is(BadRequest)(cause) ? cause : new BadRequest({ message: "Use --port, --url, --revision or --after, each with a value." }),
		try: () => flags(options),
	});
	return { action, options: { ...parsed, request } } as const;
});

function loopbackOrigin(url: string) {
	const parsed = new URL(url);
	if (
		parsed.protocol !== "http:"
		|| !["127.0.0.1", "localhost", "[::1]"].includes(parsed.hostname)
		|| parsed.username
		|| parsed.password
		|| parsed.pathname !== "/"
		|| parsed.search
		|| parsed.hash
	) {
		throw new Error("not a loopback Work Board URL");
	}
	return parsed.origin;
}

export function agentUrl(url: string) {
	return Effect.try({
		catch: () => new BadRequest({ message: "Use a loopback Work Board URL, such as http://127.0.0.1:4747." }),
		try: () => loopbackOrigin(url),
	});
}
