import { Context, type Effect } from "effect";
import type { GitHub } from "#github/service.ts";

export class GitHubClients extends Context.Service<
	GitHubClients,
	{
		readonly app: Context.Service.Shape<typeof GitHub>;
		readonly installation: (id: number) => Effect.Effect<Context.Service.Shape<typeof GitHub>>;
	}
>()("@shivaedev/github/GitHubClients") {}
