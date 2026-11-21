import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { adminStory, registrationStory, signedInAs, signedOut } from "#test/story.ts";

for (const [caller, traits, refusal] of [
	["a signed-out caller", [signedOut], "unauthorized"],
	["a user without permissions", [signedInAs("user")], "forbidden"],
	["a role assigner who reads neither page", [signedInAs("assigner")], "forbidden"],
] as const) {
	adminStory.it(
		`${caller} is ${refusal} on every operation of both pages, including their generated subscriptions`,
		traits,
		function* ({ failedJobs, jobChanges, profile, retry, userChanges }) {
			yield* outcomes([
				["failed jobs", () => failedJobs(), refusal],
				["job changes", () => jobChanges(), refusal],
				["profile", () => profile(), refusal],
				["retry of mail-42", () => retry("mail-42"), refusal],
				["user changes", () => userChanges(), refusal],
			]);
		},
	);
}

adminStory.it(
	"an operator, who reads jobs only, is served every jobs read and is forbidden on the users page",
	[signedInAs("operator")],
	function* ({ failedJobs, jobChanges, profile, userChanges }) {
		yield* outcomes([
			["failed jobs", () => failedJobs(), ["mail-42"]],
			["job changes", () => jobChanges(), ["mail-42"]],
			["profile", () => profile(), "forbidden"],
			["user changes", () => userChanges(), "forbidden"],
		]);
	},
);

adminStory.it("an operator's retry of mail-42 is served", [signedInAs("operator")], function* ({ retry }) {
	expect(yield* retry("mail-42")).toBe("retried");
});

adminStory.it(
	"an auditor, who reads users only, is served the users page and is forbidden on every jobs operation",
	[signedInAs("auditor")],
	function* ({ failedJobs, jobChanges, profile, retry, userChanges }) {
		yield* outcomes([
			["failed jobs", () => failedJobs(), "forbidden"],
			["job changes", () => jobChanges(), "forbidden"],
			["profile", () => profile(), "auditor@example.test"],
			["retry of mail-42", () => retry("mail-42"), "forbidden"],
			["user changes", () => userChanges(), "auditor@example.test"],
		]);
	},
);

for (const [page, refusal] of [
	["a page that reuses the jobs detail pattern", "Duplicate admin path: /admin/jobs/$"],
	["a page that reuses the jobs page's id", "Duplicate admin page id: jobs"],
	["a page that reuses the jobs page's path", "Duplicate admin path: /admin/jobs"],
	["a page that serves the jobs contract again", "Duplicate admin RPC tag: admin.jobs.failed"],
	["a page whose contract shares only the jobs page's generated subscription", "Duplicate admin RPC tag: admin.jobs.$changes"],
] as const) {
	registrationStory.it(`a registry refuses ${page} beside the jobs page with "${refusal}"`, [], function* ({ composeWithJobs }) {
		expect(yield* composeWithJobs(page)).toBe(refusal);
	});
}

for (const [present, missing] of [
	["jobs", "users"],
	["users", "jobs"],
] as const) {
	registrationStory.it(
		`starting the registration with the ${present} page's module alone is refused for the missing ${missing} module`,
		[],
		function* ({ startModulesFor }) {
			expect(yield* startModulesFor(present)).toBe(`Missing admin module: ${missing}`);
		},
	);
}

registrationStory.it(
	"starting the registration with a module for a reports page the registry does not hold is refused",
	[],
	function* ({ startModulesFor }) {
		expect(yield* startModulesFor("jobs", "users", "reports")).toBe("Unregistered admin module: reports");
	},
);

registrationStory.it(
	"starting the registration with each page served by the other page's module is refused, naming the jobs page",
	[],
	function* ({ startWithSwappedModules }) {
		expect(yield* startWithSwappedModules()).toBe("Admin page jobs is served by a module whose operations differ from the page's");
	},
);

for (const [role, answer] of [
	["user", "forbidden"],
	["operator", ["mail-42"]],
] as const) {
	adminStory.it(`a ${role}'s live jobs read uses the page grant`, [signedInAs(role)], function* ({ liveFailedJobs }) {
		expect(yield* liveFailedJobs()).toEqual(answer);
	});
}

adminStory.it(
	"a page grant does not override the read restriction a defined module's query runs inside its handler",
	[signedInAs("admin")],
	function* ({ restrictedProfile }) {
		expect(yield* restrictedProfile()).toBe("read denied");
	},
);

for (const [caller, traits, refusal] of [
	["a signed-out caller", [signedOut], "unauthorized"],
	["an operator, who reads jobs only,", [signedInAs("operator")], "forbidden"],
] as const) {
	adminStory.it(`${caller} is ${refusal} on a page whose operations are a defined module`, traits, function* ({ restrictedProfile }) {
		expect(yield* restrictedProfile()).toBe(refusal);
	});
}
