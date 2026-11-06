import { expect } from "@effect/vitest";
import { serviceParameters } from "#rules/effect/serviceParameters.ts";
import { carries, effectResolves, serviceModule } from "#test/effectPolicyFiles.ts";
import { repositoryHas, repositoryLinks, ruleStory } from "#test/ruleStory.ts";
import { packageRoot } from "#testing/adapters/tree.ts";

const BROWSER_PARAMETERS = [
	'import type { ComponentProps, MouseEventHandler } from "react";',
	'export class Events extends Context.Service<Events, EventTarget>()("Events") {}',
	"export const element = (element: HTMLElement) => element;",
	'export const props = (props: ComponentProps<"button">) => props;',
	"export const handler = (onClick: MouseEventHandler<HTMLButtonElement>) => onClick;",
];

ruleStory.it(
	"effect/service-parameters stops at DOM and React types while finding a real service beside props",
	[
		effectResolves(),
		repositoryLinks("node_modules/@types/react", `${packageRoot}/../react/node_modules/@types/react`),
		repositoryHas(
			serviceModule(
				"src/client/button.tsx",
				...BROWSER_PARAMETERS,
				'export const connected = (input: { props: ComponentProps<"button">; store: StoreShape }) => input;',
			),
		),
	],
	function* ({ check, messages }) {
		yield* check(serviceParameters);

		expect(yield* messages()).toEqual([carries("input")]);
	},
);
