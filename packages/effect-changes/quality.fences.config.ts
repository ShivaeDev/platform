import { fence } from "@shivaedev/quality/imports/fence.ts";
import { anything, external, folders, modules } from "@shivaedev/quality/imports/fences/selectors.ts";

const browserCode = folders("packages/effect-changes/src");

export default [
	fence("effect-changes-never-imports-server")
		.because("Browser packages ship to browsers and reach only browser-safe code.")
		.from(browserCode)
		.mayNotReach(anything.except(browserCode, modules("effect")))
		.demonstratedBy({
			illegal: ["packages/effect-changes/src/channel.ts", external("node:fs")],
			legal: ["packages/effect-changes/src/channel.ts", external("effect")],
		}),
];
