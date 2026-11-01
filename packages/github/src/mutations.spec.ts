import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { appGithub } from "#test/appGithub.ts";
import { mutationRateLimited, rejectsMutation } from "#test/mutationTraits.ts";

const LABELS = "/repos/acme/widgets/issues/1/labels";
const COMMENT = "/repos/acme/widgets/issues/comments/7";

appGithub.it(
	"PUT sends JSON to the destination with installation authentication and records its quota",
	[],
	function* ({ writeMutation, mutationRequests, mutationBudgets }) {
		yield* outcomes([
			["result", () => writeMutation("PUT", LABELS, { labels: ["ready"] }, true), [{ name: "ready" }]],
			["request", mutationRequests, [{ body: '{"labels":["ready"]}', credential: "installation token 1", method: "PUT", path: LABELS, status: 200 }]],
			["quota", mutationBudgets, [{ remaining: 4989, resource: "core" }]],
		]);
	},
);

appGithub.it(
	"DELETE sends no body and returns an empty result for 204 while recording its quota",
	[],
	function* ({ writeMutation, mutationRequests, mutationBudgets }) {
		yield* outcomes([
			["result", () => writeMutation("DELETE", COMMENT), undefined],
			["request", mutationRequests, [{ body: "", credential: "installation token 1", method: "DELETE", path: COMMENT, status: 204 }]],
			["quota", mutationBudgets, [{ remaining: 4988, resource: "core" }]],
		]);
	},
);

appGithub.it("PUT also accepts a bodyless 204 operation", [], function* ({ writeMutation, mutationRequests }) {
	yield* outcomes([
		["result", () => writeMutation("PUT", "/repos/acme/widgets/subscription"), undefined],
		[
			"request",
			mutationRequests,
			[{ body: "", credential: "installation token 1", method: "PUT", path: "/repos/acme/widgets/subscription", status: 204 }],
		],
	]);
});

appGithub.it(
	"PUT refreshes a rejected installation token and preserves method, destination and JSON",
	[rejectsMutation("putLabel")],
	function* ({ writeMutation, mutationRequests }) {
		yield* writeMutation("PUT", LABELS, { labels: ["ready"] }, true);
		expect(yield* mutationRequests()).toEqual([
			{ body: '{"labels":["ready"]}', credential: "installation token 1", method: "PUT", path: LABELS, status: 401 },
			{ body: '{"labels":["ready"]}', credential: "installation token 2", method: "PUT", path: LABELS, status: 200 },
		]);
	},
);

appGithub.it(
	"DELETE refreshes a rejected installation token and still returns an empty result",
	[rejectsMutation("deleteComment")],
	function* ({ writeMutation, mutationRequests }) {
		yield* outcomes([
			["result", () => writeMutation("DELETE", COMMENT), undefined],
			[
				"requests",
				mutationRequests,
				[
					{ body: "", credential: "installation token 1", method: "DELETE", path: COMMENT, status: 401 },
					{ body: "", credential: "installation token 2", method: "DELETE", path: COMMENT, status: 204 },
				],
			],
		]);
	},
);

appGithub.it(
	"a rate-limited PUT blocks a subsequent DELETE locally on the same resource",
	[mutationRateLimited],
	function* ({ writeMutation, mutationRequests }) {
		yield* outcomes([
			["PUT failure", () => writeMutation("PUT", LABELS, { labels: ["ready"] }, true), "rate limited on core until 01:00:00"],
			["DELETE failure", () => writeMutation("DELETE", COMMENT), "rate limited on core until 01:00:00"],
			[
				"requests",
				mutationRequests,
				[{ body: '{"labels":["ready"]}', credential: "installation token 1", method: "PUT", path: LABELS, status: 403 }],
			],
		]);
	},
);
