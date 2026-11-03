import { Effect } from "effect";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { environmentClient } from "#test/environmentClient.ts";

const fetchGithub = environmentClient("Fetch");
const nodeGithub = environmentClient("Node");

for (const [transport, github] of [
	["Fetch", fetchGithub],
	["Node", nodeGithub],
] as const) {
	github.it(`API reads use the supplied ${transport} client to reach GitHub`, [], function* ({ readPull, requestsReceived }) {
		const pull = yield* readPull();

		yield* outcomes([
			["pull read", () => Effect.succeed(pull), { number: 1, title: "Pull request 1" }],
			["requests received", () => requestsReceived(), [{ client: transport, path: "/repos/acme/widgets/pulls/1" }]],
		]);
	});

	github.it(`artifact downloads use the supplied ${transport} client for GitHub and storage`, [], function* ({ downloadArchive, requestsReceived }) {
		const files = yield* downloadArchive();

		yield* outcomes([
			["files downloaded", () => Effect.succeed(files), [{ bytes: new TextEncoder().encode("Artifact report\n"), path: "report.txt" }]],
			[
				"requests received",
				() => requestsReceived(),
				[
					{ client: transport, path: "/repos/acme/widgets/actions/artifacts/7/zip" },
					{ client: transport, path: "/storage/archive.zip" },
				],
			],
		]);
	});

	github.it(
		`artifact downloads with the supplied ${transport} client refuse another storage redirect`,
		[github.storageRedirects],
		function* ({ downloadArchive, requestsReceived }) {
			const answer = yield* downloadArchive();

			yield* outcomes([
				["download answered", () => Effect.succeed(answer), "artifact download answered HTTP 302"],
				[
					"requests received",
					() => requestsReceived(),
					[
						{ client: transport, path: "/repos/acme/widgets/actions/artifacts/7/zip" },
						{ client: transport, path: "/storage/archive.zip" },
					],
				],
			]);
		},
	);
}
