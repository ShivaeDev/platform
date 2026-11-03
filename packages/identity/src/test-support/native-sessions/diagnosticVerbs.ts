import { Effect } from "effect";
import { callers } from "./callers.ts";
import type { Host } from "./host.ts";
import type { Account } from "./requests.ts";

export function diagnosticVerbs(host: Host, accounts: Map<string, Account>, tell: (line: string) => void) {
	const { account, headersOf } = callers(accounts);
	return {
		credentialLeaks: (name: string) =>
			Effect.sync(() => {
				const { credential, token } = account(name);
				const secrets = { credential, "encoded credential": encodeURIComponent(credential ?? ""), token };
				const outputs = { logs: JSON.stringify(host.logs), spans: JSON.stringify(host.receiver.spans) };
				return Object.entries(outputs).flatMap(([output, text]) =>
					Object.entries(secrets)
						.filter(([, secret]) => secret !== undefined && secret !== null && secret !== "" && text.includes(secret))
						.map(([secret]) => `${secret} in ${output}`),
				);
			}),
		diagnosticMentions: (text: string) =>
			Effect.sync(() =>
				Object.entries({ logs: JSON.stringify(host.logs), spans: JSON.stringify(host.receiver.spans) })
					.filter(([, output]) => output.includes(text))
					.map(([output]) => output),
			),
		hostStops: () => {
			tell("the host stops and flushes its diagnostics");
			return host.stop;
		},
		recordDiagnostics: (name: string) =>
			Effect.gen(function* () {
				tell(`an HTTP route records ${name}'s bearer in its diagnostics`);
				const response = yield* Effect.promise(() => fetch(`${host.baseUrl}/diagnostic`, { headers: headersOf({ bearer: name }) }));
				yield* Effect.promise(() => response.text());
			}),
	};
}
