import { fence } from "@shivaedev/quality/imports/fence.ts";
import { anything, external, files, modules, packages } from "@shivaedev/quality/imports/fences/selectors.ts";

const browserCode = files("packages/effect-trpc/src/rejectionDecoding.ts");

export default [
	fence("trpc-client-stays-browser-safe")
		.because("The client modules ship to browsers and reach only browser-safe code.")
		.from(browserCode)
		.mayNotReach(anything.except(browserCode, packages("contract", "form", "react", "types"), modules("effect")))
		.demonstratedBy({
			illegal: ["packages/effect-trpc/src/rejectionDecoding.ts", external("@trpc/server")],
			legal: ["packages/effect-trpc/src/rejectionDecoding.ts", external("effect")],
		}),
];
