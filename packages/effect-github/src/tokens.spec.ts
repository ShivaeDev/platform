import { Effect } from "effect";
import { expect } from "vitest";
import { GitHubTransportError } from "#errors.ts";
import { FIXTURE_TOKEN } from "#test/fixtures.ts";
import { github } from "#test/github.ts";

github.it("GH_TOKEN takes precedence over GITHUB_TOKEN in authenticated reads", [], function* ({ readWithEnvironment, requests }) {
	yield* readWithEnvironment({ "GH_TOKEN": "preferred-token", "GITHUB_TOKEN": "fallback-token" });
	expect(requests()[0]?.headers.authorization).toBe("Bearer preferred-token");
});

github.it("GITHUB_TOKEN authenticates when GH_TOKEN is absent", [], function* ({ readWithEnvironment, requests }) {
	yield* readWithEnvironment({ "GITHUB_TOKEN": "fallback-token" });
	expect(requests()[0]?.headers.authorization).toBe("Bearer fallback-token");
});

github.it("an absent environment token permits anonymous reads", [], function* ({ readWithEnvironment, requests }) {
	yield* readWithEnvironment({});
	expect(requests()[0]?.headers.authorization).toBeUndefined();
});

github.it("a transport failure retains neither credentials nor the query in its error", [], function* ({ dropConnection, readPull, telemetry }) {
	yield* dropConnection();
	const error = yield* Effect.flip(readPull());
	expect(error).toEqual(new GitHubTransportError({ path: "/repos/acme/widgets/pulls/1" }));
	const { logs, spans } = telemetry();
	const captured = JSON.stringify({
		error,
		logs,
		spans: spans.map((span) => ({
			attributes: [...span.attributes],
			events: span.events.map(([name, , attributes]) => ({ attributes, name })),
			exit: span.status._tag === "Ended" ? span.status.exit : undefined,
		})),
	});
	expect(captured).not.toContain(FIXTURE_TOKEN);
	expect(JSON.stringify(error)).not.toContain("query-secret");
});
