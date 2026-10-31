import { expect } from "@effect/vitest";
import { Effect } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { fleetSupervisor, pluginCheckout } from "#test/supervisorStory.ts";

fleetSupervisor.it(
	"builds a missing plugin bundle before starting services and rebuilds changed plugin sources",
	[pluginCheckout],
	function* (fleet) {
		expect(fleet.pluginRegisterExists()).toBe(false);
		yield* fleet.start();
		yield* fleet.ready("daemon");
		yield* fleet.ready("board");
		const before = yield* fleet.running();
		expect(fleet.pluginRegisterExists()).toBe(true);
		expect(fleet.pluginBundle()).toContain("Work Board");
		expect(fleet.log().indexOf("built Work Board plugin client bundle")).toBeLessThan(fleet.log().indexOf("started daemon"));

		const offset = fleet.log().length;
		yield* fleet.editPlugin('const TITLE = "Rebuilt Board pane";');
		yield* fleet.waitForLog("built Work Board plugin client bundle", offset);

		expect(fleet.pluginBundle()).toContain("Rebuilt Board pane");
		expect(yield* fleet.state()).toEqual(before);

		const bundle = fleet.pluginBundle();
		const failureOffset = fleet.log().length;
		yield* fleet.editPlugin("const TITLE = ;");
		yield* fleet.waitForLog("Work Board plugin build failed", failureOffset);

		expect(fleet.log().slice(failureOffset)).toContain("Unexpected");
		expect(fleet.pluginBundle()).toBe(bundle);
		yield* outcomes([
			["running services", () => fleet.state(), before],
			["Fleet response", () => fleet.request(before, "daemon").pipe(Effect.map(({ status }) => status)), HttpStatus.fromLiteral("NoContent")],
			["Board response", () => fleet.request(before, "board").pipe(Effect.map(({ status }) => status)), HttpStatus.fromLiteral("OK")],
		]);

		const recoveryOffset = fleet.log().length;
		yield* fleet.editPlugin('const TITLE = "Recovered Board pane";');
		yield* fleet.waitForLog("built Work Board plugin client bundle", recoveryOffset);

		expect(fleet.pluginBundle()).toContain("Recovered Board pane");
		expect(yield* fleet.state()).toEqual(before);
	},
	60_000,
);

fleetSupervisor.it(
	"logs a plugin build error and keeps Fleet and Board serving",
	[pluginCheckout],
	function* (fleet) {
		yield* fleet.editPlugin("const TITLE = ;");
		yield* fleet.start();
		yield* fleet.ready("daemon");
		yield* fleet.ready("board");
		const state = yield* fleet.running();
		expect(fleet.log()).toContain("Work Board plugin build failed");
		expect(fleet.log()).toContain("Unexpected");
		expect(fleet.pluginRegisterExists()).toBe(false);
		yield* outcomes([
			["Fleet response", () => fleet.request(state, "daemon").pipe(Effect.map(({ status }) => status)), HttpStatus.fromLiteral("NoContent")],
			["Board response", () => fleet.request(state, "board").pipe(Effect.map(({ status }) => status)), HttpStatus.fromLiteral("OK")],
		]);
	},
	60_000,
);
