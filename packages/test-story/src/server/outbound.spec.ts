import { expect } from "vitest";
import { outboundKit } from "#test/outbound.ts";
import { storyRunner } from "#test/storyRunner.ts";

const ROUTED_STORY = [
	"around reached the fake server at /original",
	"create reached the fake server at /original",
	"trait reached the fake server at /original",
	"after hook reached the fake server at /original",
	"body reached the fake server at /original",
	"create finalizer reached the fake server at /original",
	"after the story reached the real server at /original",
];

outboundKit.it("routes a selected hostname to its fake server and keeps the request's method, path, header and body", [], function* ({ sends }) {
	expect(
		yield* sends("https://github.com/login/oauth/access_token?client_id=story", {
			body: "code=story-code",
			headers: { "x-story": "token" },
			method: "POST",
		}),
	).toEqual({ body: "code=story-code", header: "token", method: "POST", name: "fake", path: "/login/oauth/access_token?client_id=story" });
});

outboundKit.it("routes each selected hostname to its own target", [], function* ({ reaches }) {
	expect(yield* reaches("https://api.github.com/user")).toBe("the fake server at /user");
});

outboundKit.it("leaves a hostname the kit does not select on its real server", [], function* ({ localhost, reaches }) {
	expect(yield* reaches(localhost("/other"))).toBe("the real server at /other");
});

for (const ending of ["passes", "fails"]) {
	storyRunner.it(`routes every hook and finalizer of a story and restores real routing after it ${ending}`, [], function* ({ lifetime, runStory }) {
		yield* runStory("outboundStories", `Outbound Story: ${ending} with outbound routing`);

		expect(yield* lifetime()).toEqual(ROUTED_STORY);
	});
}

storyRunner.it("routes the next story again after a failed story restored real routing", [], function* ({ lifetime, run }) {
	yield* run("outboundStories");

	expect(yield* lifetime()).toEqual([...ROUTED_STORY, ...ROUTED_STORY]);
});
