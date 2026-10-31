import { expect } from "@effect/vitest";
import { Effect } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { fleetSupervisor, lockedDependencies, pluginCheckout } from "#test/supervisorStory.ts";

fleetSupervisor.it(
	"installs a changed lockfile once before rebuilding the plugin and restarting both services, without installing for source edits",
	[pluginCheckout, lockedDependencies],
	function* (fleet) {
		yield* fleet.start();
		yield* fleet.ready("daemon");
		yield* fleet.ready("board");
		const before = yield* fleet.running();
		expect(fleet.log()).toContain("building with dependency one");
		expect(fleet.log()).not.toContain("installing locked dependencies");
		const offset = fleet.log().length;

		yield* fleet.editLockfile("change");
		yield* fleet.ready("daemon", before.daemon.pid);
		yield* fleet.ready("board", before.board.pid);
		const after = yield* fleet.running();
		const log = fleet.log().slice(offset);
		expect(log.match(/installing locked dependencies/gu)).toEqual(["installing locked dependencies"]);
		expect(log.match(/built Work Board plugin client bundle/gu)).toEqual(["built Work Board plugin client bundle"]);
		expect(log).toContain("building with dependency two");
		expect(log.indexOf("installed locked dependencies")).toBeLessThan(log.indexOf("building Work Board plugin"));
		expect(log.indexOf("built Work Board plugin client bundle")).toBeLessThan(log.indexOf("daemon dependencies changed"));
		expect(log.indexOf("built Work Board plugin client bundle")).toBeLessThan(log.indexOf("board dependencies changed"));
		expect(after.daemon.restarts).toBe(before.daemon.restarts + 1);
		expect(after.board.restarts).toBe(before.board.restarts + 1);
		const sourceOffset = fleet.log().length;

		yield* fleet.editPlugin('const TITLE = "Source change without installation";');
		yield* fleet.changeCode();
		yield* fleet.waitForLog("built Work Board plugin client bundle", sourceOffset);
		yield* fleet.ready("daemon", after.daemon.pid);
		yield* fleet.codeSettled("daemon");

		expect(fleet.pluginBundle()).toContain("Source change without installation");
		expect(fleet.log().slice(sourceOffset)).not.toContain("installing locked dependencies");
		expect((yield* fleet.running()).board).toEqual(after.board);
	},
	60_000,
);

fleetSupervisor.it(
	"logs a failed locked install and keeps the existing Fleet, Board and plugin serving until the lockfile changes again",
	[pluginCheckout, lockedDependencies],
	function* (fleet) {
		yield* fleet.start();
		yield* fleet.ready("daemon");
		yield* fleet.ready("board");
		const before = yield* fleet.running();
		const bundle = fleet.pluginBundle();
		const offset = fleet.log().length;

		yield* fleet.editLockfile("fail");
		yield* fleet.changeCode();
		yield* fleet.changeBoardCode();
		yield* fleet.editPlugin('const TITLE = "After install recovery";');
		yield* fleet.waitForLog("Dependency install failed", offset);

		const log = fleet.log().slice(offset);
		expect(log).toContain("ERR_PNPM");
		expect(log).toContain("exit 1");
		expect(log).not.toContain("building Work Board plugin");
		expect(fleet.pluginBundle()).toBe(bundle);
		yield* outcomes([
			["running services", () => fleet.state(), before],
			["Fleet response", () => fleet.request(before, "daemon").pipe(Effect.map(({ status }) => status)), HttpStatus.fromLiteral("NoContent")],
			["Board response", () => fleet.request(before, "board").pipe(Effect.map(({ status }) => status)), HttpStatus.fromLiteral("OK")],
		]);

		yield* fleet.editLockfile("change");
		yield* fleet.ready("daemon", before.daemon.pid);
		yield* fleet.ready("board", before.board.pid);

		expect(fleet.pluginBundle()).toContain("After install recovery");
		expect(
			fleet
				.log()
				.slice(offset)
				.match(/installing locked dependencies/gu),
		).toEqual(["installing locked dependencies", "installing locked dependencies"]);
	},
	60_000,
);
