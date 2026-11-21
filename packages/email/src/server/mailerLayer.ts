import { Config, Effect, Layer } from "effect";
import { resendMailerLayer } from "#server/adapters/resendMailerLayer.ts";
import { Mailer } from "#server/log-mailer/service.ts";

export function mailerLayer() {
	return Layer.unwrap(
		Effect.gen(function* () {
			const environment = yield* Config.String("NODE_ENV").pipe(Config.withDefault("development"));
			if (environment !== "production") {
				return Mailer.layer;
			}
			yield* Config.String("EMAIL_FROM");
			return resendMailerLayer();
		}),
	);
}
