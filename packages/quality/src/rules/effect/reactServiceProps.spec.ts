import { expect } from "@effect/vitest";
import { serviceParameters } from "#rules/effect/serviceParameters.ts";
import { effectResolves } from "#test/effectPolicyFiles.ts";
import { repositoryHas, repositoryLinks, ruleStory } from "#test/ruleStory.ts";
import { packageRoot } from "#testing/adapters/tree.ts";

for (const render of [
	"export function Provider({ connection }: Props): ReactNode { return createElement(RegistryContext.Provider, { value: connection.registry }); }",
	"export const Provider = ({ connection }: Props) => <RegistryContext.Provider value={connection.registry} />;",
	"export const Provider = ({ connection }: Props) => connection.active ? <RegistryContext.Provider value={connection.registry} /> : null;",
]) {
	ruleStory.it(
		"service parameters accepts module-level React connection props beside an ordinary registry parameter",
		[
			effectResolves(),
			repositoryLinks("node_modules/@types/react", `${packageRoot}/../react/node_modules/@types/react`),
			repositoryHas({
				content: `import { createContext, createElement, type ReactNode } from "react";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
const RegistryContext = createContext<AtomRegistry.AtomRegistry | undefined>(undefined);
export interface Props {
 readonly connection: { readonly registry: AtomRegistry.AtomRegistry; readonly wiring: string; readonly active?: object };
 readonly connect: (registry: AtomRegistry.AtomRegistry) => unknown;
}
${render}
export const inspect = (registry: AtomRegistry.AtomRegistry) => registry;
export const Pretender = (props: Props) => props.connection;`,
				path: "src/provider.tsx",
			}),
		],
		function* ({ check }) {
			expect(yield* check(serviceParameters)).toEqual([
				expect.objectContaining({ message: expect.stringContaining("Parameter registry carries a service.") }),
				expect.objectContaining({ message: expect.stringContaining("Parameter props carries a service.") }),
			]);
		},
	);
}
