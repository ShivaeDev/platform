import { describe, expect, it } from "vitest";
import { hostRefusals } from "#adapters/hostLoader.ts";

const HEADER = 'import { atom, read, update } from "claude-code";\nimport { platformClient } from "./platformClient.js";\n';

function entry(body: string, exported = "export { register };") {
	return hostRefusals("register.js", [{ name: "register.js", text: `${HEADER}${body}\n${exported}\n` }]);
}

function hooks(...lines: string[]) {
	return entry(`function helper($) { return $.clock.now(); }\nfunction register(on) {\n${lines.join("\n")}\n}`);
}

describe("the host loader rules", () => {
	it("passes an entry that declares register at the top and spells every $ call as written", () => {
		expect(
			hooks(
				'on("session.start", async ($, e, next) => { await $.command.register({ name: "workboard" }); await helper($); return next(e); });',
				'on("command.run", { command: "workboard" }, async ($) => ({ text: String(await read($, atom({ key: "k", plugin: "p" }, 0))) }));',
				'on("ui.render", { component: "Pane" }, ($, e, next) => next.to(e, "append"));',
			),
		).toEqual([]);
	});

	it("refuses the minified entry that bound register to a renamed var", () => {
		expect(entry('var Lo=o=>{o("session.start",async(e,t,r)=>r(t))};', "export{Lo as register};")).toEqual([
			"register.js: register is not exported as the function register(on) declared at the top of this file",
		]);
		expect(entry("const register = (on) => {};")).toEqual([
			"register.js: register is not exported as the function register(on) declared at the top of this file",
		]);
	});

	it("refuses $ handed to anything but a function declared at the top of the file, or a noun of $ taken as a value", () => {
		expect(hooks('on("session.start", ($) => { connections.get($); });')).toEqual([
			"register.js:5: $ is used other than as $.noun.method(...) or as an argument to a function declared at the top of this file",
		]);
		expect(hooks('on("session.start", ($) => platformClient($.clock.now));')).toEqual([
			"register.js:5: $.clock is used other than as $.noun.method(...)",
		]);
		expect(hooks('on("session.start", ($) => update(1, $, () => 2));')).toEqual([
			"register.js:5: $ is passed to update other than as its first argument",
		]);
		expect(hooks('on("session.start", ($) => $?.ui.toast("x"));')).toEqual(["register.js:5: $.ui is used other than as $.noun.method(...)"]);
	});

	it("refuses on called other than as on(<literal event>, matcher?, hook) with a hook that takes $", () => {
		expect(hooks("on(name, ($) => undefined);")).toEqual(["register.js:5: on names its event other than as a string literal"]);
		expect(hooks('on("session.start", (e, t, r) => r(t));')).toEqual([
			'register.js:5: on("session.start") takes a hook whose first parameter is not named $',
		]);
		expect(hooks('on("command.run", matcher, ($) => undefined);')).toEqual([
			'register.js:5: on("command.run") takes its matcher other than as an object written in the call',
		]);
	});

	it("refuses next.to other than as next.to(e, <literal tier>)", () => {
		expect(hooks('on("ui.render", ($, e, next) => next.to(e, tier));')).toEqual([
			'register.js:5: next.to is used other than as next.to(e, "<tier>")',
		]);
	});

	it("refuses a dynamic import, a package import or a file over the size the host reads, in any emitted file", () => {
		expect(
			hostRefusals("register.js", [
				{ name: "register.js", text: 'export function register(on) {}\nimport { Effect } from "effect";' },
				{ name: "platformClient.js", text: 'export const load = () => import("./later.js");' },
				{ name: "shared.js", text: `export const big = "${"x".repeat(1_048_576)}";` },
			]),
		).toEqual([
			'register.js:2: imports "effect", which is neither claude-code nor a file beside it',
			"platformClient.js:1: holds a dynamic import()",
			"shared.js: is over 1048576 bytes, which the host does not read",
		]);
	});
});
