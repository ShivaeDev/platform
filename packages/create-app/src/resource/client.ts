import type { ResourceNames } from "#resource/names.ts";

export function resourceClientModule({ camel, name, pascal }: ResourceNames) {
	return `import { createRoute } from "@tanstack/react-router";
import type { ReactElement } from "react";
import { clientModule } from "@shivaedev/react/client/module.ts";
import { ${pascal} } from "#generated/modules/${name}/${pascal}.ts";
import { ${pascal}Screen } from "#modules/${name}/client/Screen.tsx";

export const ${camel}Module = clientModule({ ${camel}: ${pascal} }, ({ ${camel} }) => ({
	routes: (root) => [
		createRoute({
			component: (): ReactElement => <${pascal}Screen client={${camel}} />,
			getParentRoute: () => root,
			path: "/${name}",
			staticData: { signedIn: true },
		}),
	],
}));
`;
}

export function resourceScreen({ name, pascal }: ResourceNames) {
	return `import { Option } from "effect";
import type { ReactElement } from "react";
import type { ContractClient } from "@shivaedev/contract/makeClient.ts";
import { useQuery } from "@shivaedev/react/client/resultState.ts";
import type { ${pascal} } from "#generated/modules/${name}/${pascal}.ts";

function listOf(items: readonly { readonly id: number; readonly title: string }[]): ReactElement {
	if (items.length === 0) {
		return <p>No items yet.</p>;
	}
	return (
		<ul aria-label="${pascal}">
			{items.map((item) => (
				<li key={item.id}>{item.title}</li>
			))}
		</ul>
	);
}

export function ${pascal}Screen({ client }: { readonly client: ContractClient<typeof ${pascal}> }): ReactElement {
	const items = useQuery(client.list.query());
	return (
		<main className="space-y-4 p-8">
			<h1 className="text-3xl font-semibold">${pascal}</h1>
			{Option.match(items.data, { onNone: () => <p role="status">Loading…</p>, onSome: listOf })}
		</main>
	);
}
`;
}

export function resourceScreenKit({ name }: ResourceNames) {
	return `import { DateTime, Effect } from "effect";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { appScreen } from "#test-support/appScreen.tsx";
import { configured, postgres } from "#test-support/postgres.ts";
import { uiScreenVerbs } from "#test-support/uiScreenVerbs.ts";

export const screen = storyKit({
	around: withIsolatedDatabase,
	clock: Effect.runSync(DateTime.now),
	create: () => appScreen({ account: { name: "alice" }, route: "/${name}" }),
	inspect: ({ history, view }) => ({ route: history.location.pathname, text: view.container.textContent }),
	layer: postgres,
	name: "${name} screen",
	runIf: configured,
	stages: [],
	verbs: (engine, story) => uiScreenVerbs(engine, story.tell),
});
`;
}

export function resourceScreenStory({ name, pascal }: ResourceNames) {
	return `import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { screen } from "#modules/${name}/test-support/screen.ts";

screen.it("signed-in alice opens /${name}, which the module's folder adds to the app, and sees her empty list", [], function* ({ controlTexts, heading, settle }) {
	yield* settle();

	yield* outcomes([
		["page", heading, "${pascal}"],
		["list", () => controlTexts("main p"), ["No items yet."]],
	]);
});
`;
}
