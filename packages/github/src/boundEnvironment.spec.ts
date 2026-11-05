import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { github } from "#test/github.ts";

github.it(
	"deferred pagination uses the Layer's credentials and API URL under another caller environment",
	[],
	function* ({ listWithAnotherCallEnvironment, credentialsSent, requests }) {
		yield* listWithAnotherCallEnvironment();

		yield* outcomes([
			["credentials", () => credentialsSent(), ["the configured token", "the configured token", "the configured token"]],
			[
				"requests",
				() => requests(),
				["GET /repos/acme/widgets/pulls 200", "GET /repos/acme/widgets/pulls?page=2 200", "GET /repos/acme/widgets/pulls?page=3 200"],
			],
		]);
	},
);
