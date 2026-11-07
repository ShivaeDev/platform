import { Context, type Duration } from "effect";
import type { RoleSet } from "@shivaedev/access/roleSet.ts";
import type { OriginPolicy } from "#server/origin.ts";
import type { SessionProvider, SessionShape } from "#server/session.ts";

export class SessionPolicy extends Context.Service<
	SessionPolicy,
	{
		readonly origin: OriginPolicy;
		readonly provider: SessionProvider<SessionShape>;
		readonly roles?: RoleSet;
		readonly streamRevalidationInterval?: Duration.Input | undefined;
	}
>()("@shivaedev/identity/SessionPolicy") {}
