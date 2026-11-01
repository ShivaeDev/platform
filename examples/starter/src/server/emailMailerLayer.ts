import { Config, Effect, Layer } from "effect";
import { resendMailerLayer } from "@shivaedev/email/server/adapters/resendMailerLayer.ts";
import { logMailerLayer } from "@shivaedev/email/server/Mailer.ts";

export function emailMailerLayer() {
	return Layer.unwrap(
		Effect.gen(function* () {
			const production = yield* Config.String("NODE_ENV").pipe(Config.withDefault("development"));
			return production === "production" ? resendMailerLayer() : logMailerLayer;
		}),
	);
}
