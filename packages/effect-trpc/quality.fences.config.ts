import { fence } from "@shivaedev/quality/imports/fences/dsl.ts";
import { anything, external, folders, modules, packages } from "@shivaedev/quality/imports/fences/selectors.ts";

const browserCode = folders("packages/effect-trpc/src/client");

export default [
	fence("trpc-client-stays-browser-safe")
		.because("The client modules ship to browsers and reach only browser-safe code.")
		.from(browserCode)
		.mayNotReach(anything.except(browserCode, packages("effect-contract", "effect-form", "effect-react", "types"), modules("effect")))
		.demonstratedBy({
			illegal: ["packages/effect-trpc/src/client/rejection.ts", external("@trpc/server")],
			legal: ["packages/effect-trpc/src/client/rejection.ts", external("effect")],
		}),
];
