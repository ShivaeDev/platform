import type { SessionRouting } from "@shivaedev/react/client/sessionRouter.ts";
import { Forbidden } from "@shivaedev/react/Forbidden.ts";
import { Home } from "#client/Home.tsx";
import { Shell } from "#client/Shell.tsx";
import { parseSearch, stringifySearch } from "#client/search.ts";

export const routing = {
	forbidden: <Forbidden backLabel="Back to home" className="space-y-4 p-8 [&_a]:underline [&_h1]:text-3xl [&_h1]:font-semibold" to="/" />,
	home: Home,
	parseSearch,
	shell: Shell,
	stringifySearch,
} satisfies SessionRouting;
