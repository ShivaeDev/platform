import { Cause, Effect, Exit } from "effect";
import { expect } from "vitest";
import { adapterServices, consumerInstrumentationThrows, consumerMapperThrows, runtimeAcquisitionFails } from "#test/adapterRouter.ts";
import { declaredRejections } from "#test/declaredRejections.ts";
import { inputIssues } from "#test/inputIssues.ts";
import { orderContracts } from "#test/orderContracts.ts";
import { profileInputs } from "#test/profileInputs.ts";
import { rejectionRules } from "#test/rejectionRules.ts";
import { routerConfiguration } from "#test/routerConfiguration.ts";
import { trpc } from "#test/routerStory.ts";

const routers = [
	{ name: "adapterServices", trait: adapterServices() },
	{ name: "declaredRejections", trait: declaredRejections() },
	{ name: "orderContracts", trait: orderContracts() },
	{ name: "profileInputs", trait: profileInputs() },
	{ name: "rejectionRules", trait: rejectionRules() },
	{ name: "inputIssues", trait: inputIssues([{ message: "Invalid" }]) },
];
const modes = [
	{ name: "consumerInstrumentationThrows", trait: consumerInstrumentationThrows() },
	{ name: "consumerMapperThrows", trait: consumerMapperThrows() },
	{ name: "runtimeAcquisitionFails", trait: runtimeAcquisitionFails() },
];

for (const [kind, choices] of [
	["Router", routers],
	["Mode", modes],
] as const) {
	for (const first of choices) {
		for (const second of choices) {
			routerConfiguration.it(`refuses ${first.name} followed by ${second.name}`, [], function* ({ configure }) {
				yield* configure(first.trait);
				const exit = yield* Effect.exit(configure(second.trait));
				if (Exit.isSuccess(exit)) {
					throw new Error("Conflicting traits must fail during setup");
				}
				expect(Cause.pretty(exit.cause)).toContain(`${kind} traits ${first.name} and ${second.name} cannot be combined`);
			});
		}
	}
}

for (const { name, trait, path } of [
	{ name: "declaredRejections", path: "explicit", trait: declaredRejections() },
	{ name: "orderContracts", path: "forget", trait: orderContracts() },
	{ name: "profileInputs", path: "constructed", trait: profileInputs() },
	{ name: "rejectionRules", path: "success", trait: rejectionRules() },
]) {
	trpc.it(`applies runtime acquisition failures to ${name}`, [trait, runtimeAcquisitionFails()], function* ({ rejectCaller, mapped }) {
		expect(yield* rejectCaller(path)).toMatchObject({ code: "INTERNAL_SERVER_ERROR", message: "Internal server error" });
		expect(mapped).toEqual([{ error: expect.objectContaining({ message: "private runtime acquisition detail" }), origin: "failure", path }]);
	});
}

for (const path of ["stream", "neverStream", "failedStream", "ambientStream", "transformedStream"]) {
	trpc.it(`refuses a start notification from ${path}`, [adapterServices()], function* ({ subscribe, started, story }) {
		const iterator = yield* subscribe(path);
		const exit = yield* Effect.exit(started(iterator));
		if (Exit.isSuccess(exit)) {
			throw new Error("A subscription without a start notification must fail immediately");
		}
		expect(Cause.pretty(exit.cause)).toContain(`Subscription ${path} cannot report a start`);
		expect(story.lines).toContain(`wait for ${path} to start`);
	});
}
