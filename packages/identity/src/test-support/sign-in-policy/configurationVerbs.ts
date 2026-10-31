import { Cause, Config, Effect, Exit } from "effect";
import type { PolicyHost, policyHost } from "./host.ts";

interface ConfigurationEngine {
	readonly env: Record<string, string>;
	readonly host: { current?: PolicyHost };
	startup?: string;
}

export function configurationVerbs(engine: ConfigurationEngine, start: () => ReturnType<typeof policyHost>, tell: (message: string) => void) {
	return {
		configureAccounts: (entries: string) =>
			Effect.sync(() => {
				tell(`the operator sets AUTH_ALLOWED_ACCOUNTS to ${JSON.stringify(entries)}`);
				engine.env.AUTH_ALLOWED_ACCOUNTS = entries;
			}),
		restart: () =>
			Effect.gen(function* () {
				tell("the application restarts with the current configuration");
				const restarted = yield* Effect.exit(start());
				if (Exit.isSuccess(restarted)) {
					engine.host.current = restarted.value;
					engine.startup = "started";
					return;
				}
				const error = Cause.findErrorOption(restarted.cause);
				engine.startup =
					error._tag === "Some" && error.value instanceof Config.ConfigError
						? `refused to start: ${error.value.message.replaceAll(/\s+/gu, " ")}`
						: `crashed: ${Cause.pretty(restarted.cause)}`;
			}),
		startup: () =>
			Effect.sync(() => {
				if (engine.startup === undefined) {
					throw new Error("The application has not restarted");
				}
				return engine.startup;
			}),
	};
}
