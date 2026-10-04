import { Effect, Exit } from "effect";
import { expect } from "vitest";
import { ChangeHost } from "#ports.ts";
import { checkoutResponses, effectApp, published, revision, SAFE_CONFIG, scriptedGitHub, work } from "./githubFixtures.ts";

effectApp("publishes scoped exact commits with approved public PR metadata", function* () {
	const fixture = scriptedGitHub([...checkoutResponses(), "[]", "", "", published.url, JSON.stringify([published])]);
	const result = yield* Effect.flatMap(ChangeHost, (host) => host.publish(work, revision)).pipe(Effect.provide(fixture.layer));
	expect(result).toEqual({ kind: "pull-request", number: 12, revision, url: published.url });
	expect(fixture.calls.find((call) => call.args.includes("push"))?.args).toEqual([
		"-c",
		"core.hooksPath=/dev/null",
		"-c",
		"core.fsmonitor=false",
		"push",
		"origin",
		`${revision}:refs/heads/work-fleet/example`,
	]);
	const creation = fixture.calls.find((call) => call.args[1] === "create");
	expect(creation?.args).toContain(work.pullRequest?.body);
	expect(creation?.args).not.toContain(work.instructions);
});
effectApp("recovers an existing acknowledgement without push or create", function* () {
	const fixture = scriptedGitHub([JSON.stringify([published])]);
	const result = yield* Effect.flatMap(ChangeHost, (host) => host.findPublished(work, revision)).pipe(Effect.provide(fixture.layer));
	expect(result?.number).toBe(12);
	expect(fixture.calls).toHaveLength(1);
	expect(fixture.calls[0]?.args[1]).toBe("list");
});
effectApp("keeps uncertain publication unknown without creating a replacement", function* () {
	const fixture = scriptedGitHub(["[]"]);
	const result = yield* Effect.flatMap(ChangeHost, (host) => host.findPublished(work, revision)).pipe(Effect.provide(fixture.layer));
	expect(result).toBeNull();
	expect(fixture.calls).toHaveLength(1);
});
effectApp("repairs only the durable prior PR by pushing its branch without creating another", function* () {
	const previous = { kind: "pull-request", number: 12, revision: "c".repeat(40), url: published.url } as const;
	const fixture = scriptedGitHub([
		...checkoutResponses(),
		JSON.stringify([{ ...published, headRefOid: previous.revision }]),
		`${previous.revision}\trefs/heads/work-fleet/example\n`,
		"",
		JSON.stringify([published]),
	]);
	yield* Effect.flatMap(ChangeHost, (host) => host.publish(work, revision, previous)).pipe(Effect.provide(fixture.layer));
	expect(fixture.calls.some((call) => call.args[1] === "create")).toBe(false);
	expect(fixture.calls.some((call) => call.args.includes("push"))).toBe(true);
});
effectApp("refuses changes beyond approved whole-file authority", function* () {
	for (const scope of [[{ key: null, path: "other" }], [{ key: "field", path: "src/feature.ts" }]]) {
		const fixture = scriptedGitHub(checkoutResponses());
		const result = yield* Effect.flatMap(ChangeHost, (host) => host.publish({ ...work, scope }, revision)).pipe(
			Effect.provide(fixture.layer),
			Effect.exit,
		);
		expect(Exit.isFailure(result)).toBe(true);
		expect(fixture.calls.some((call) => call.args.includes("push"))).toBe(false);
	}
});
effectApp("requires approved public PR metadata before publishing a branch", function* () {
	const fixture = scriptedGitHub([...checkoutResponses(), "[]", ""]);
	const { pullRequest: _, ...withoutMetadata } = work;
	const result = yield* Effect.flatMap(ChangeHost, (host) => host.publish(withoutMetadata, revision)).pipe(
		Effect.provide(fixture.layer),
		Effect.exit,
	);
	expect(Exit.isFailure(result)).toBe(true);
	expect(fixture.calls.some((call) => call.args.includes("push"))).toBe(false);
});
effectApp("rejects an unclean checkout before any external publication", function* () {
	const fixture = scriptedGitHub([SAFE_CONFIG, "", revision, " M src/feature.ts\0"]);
	const result = yield* Effect.flatMap(ChangeHost, (host) => host.publish(work, revision)).pipe(Effect.provide(fixture.layer), Effect.exit);
	expect(Exit.isFailure(result)).toBe(true);
	expect(fixture.calls).toHaveLength(4);
});
effectApp("rejects a different push origin before fetching or publishing", function* () {
	const fixture = scriptedGitHub([SAFE_CONFIG, "", revision, "", "https://github.com/example/project.git", "https://github.com/other/project.git"]);
	const result = yield* Effect.flatMap(ChangeHost, (host) => host.publish(work, revision)).pipe(Effect.provide(fixture.layer), Effect.exit);
	expect(Exit.isFailure(result)).toBe(true);
	expect(fixture.calls).toHaveLength(6);
});
effectApp("accepts no-change only after clean revision and empty diff verification", function* () {
	const clean = scriptedGitHub([
		...checkoutResponses(""),
		revision,
		JSON.stringify([{ "check_runs": [{ conclusion: "success", "head_sha": revision, id: 1, name: "test", status: "completed" }], "total_count": 1 }]),
		JSON.stringify([{ sha: revision, statuses: [], "total_count": 0 }]),
	]);
	yield* Effect.flatMap(ChangeHost, (host) => host.verifyNoChange(work, revision)).pipe(Effect.provide(clean.layer));
	const changed = scriptedGitHub(checkoutResponses());
	const result = yield* Effect.flatMap(ChangeHost, (host) => host.verifyNoChange(work, revision)).pipe(Effect.provide(changed.layer), Effect.exit);
	expect(Exit.isFailure(result)).toBe(true);
});
effectApp("refuses no-change evidence from a revision behind the current base", function* () {
	const fixture = scriptedGitHub([...checkoutResponses(""), "c".repeat(40)]);
	const result = yield* Effect.flatMap(ChangeHost, (host) => host.verifyNoChange(work, revision)).pipe(Effect.provide(fixture.layer), Effect.exit);
	expect(Exit.isFailure(result)).toBe(true);
});
effectApp("refuses another fleet's existing PR even when it uses the same work id", function* () {
	const fixture = scriptedGitHub([...checkoutResponses(), JSON.stringify([{ ...published, headRefOid: "c".repeat(40) }])]);
	const result = yield* Effect.flatMap(ChangeHost, (host) => host.publish(work, revision)).pipe(Effect.provide(fixture.layer), Effect.exit);
	expect(Exit.isFailure(result)).toBe(true);
	expect(fixture.calls.some((call) => call.args.includes("push"))).toBe(false);
});
effectApp("refuses an unrecognized remote branch before opening a PR", function* () {
	const fixture = scriptedGitHub([...checkoutResponses(), "[]", `${"c".repeat(40)}\trefs/heads/work-fleet/example\n`]);
	const result = yield* Effect.flatMap(ChangeHost, (host) => host.publish(work, revision)).pipe(Effect.provide(fixture.layer), Effect.exit);
	expect(Exit.isFailure(result)).toBe(true);
	expect(fixture.calls.some((call) => call.args.includes("push"))).toBe(false);
});
for (const dangerous of [
	"include.path\n/tmp/other",
	"core.sshcommand\nexample",
	"core.fsmonitor\nexample",
	"credential.helper\n!example",
	"core.worktree\n/tmp/other",
]) {
	effectApp(`rejects untrusted executable Git configuration: ${dangerous.split("\n")[0]}`, function* () {
		const fixture = scriptedGitHub([`${SAFE_CONFIG}${dangerous}\0`]);
		const result = yield* Effect.flatMap(ChangeHost, (host) => host.publish(work, revision)).pipe(Effect.provide(fixture.layer), Effect.exit);
		expect(Exit.isFailure(result)).toBe(true);
		expect(fixture.calls).toHaveLength(1);
	});
}
effectApp("refuses multiple push destinations hidden behind one origin name", function* () {
	const fixture = scriptedGitHub([`${SAFE_CONFIG}remote.origin.url\nhttps://github.com/other/project.git\0`]);
	const result = yield* Effect.flatMap(ChangeHost, (host) => host.publish(work, revision)).pipe(Effect.provide(fixture.layer), Effect.exit);
	expect(Exit.isFailure(result)).toBe(true);
	expect(fixture.calls).toHaveLength(1);
});
