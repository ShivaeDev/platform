import { Clock, Deferred, Effect, Layer } from "effect";
import { GithubApi } from "#host/githubApi.ts";
import { syntheticGithub } from "#test/githubApi.ts";
import { host } from "#test/hostStory.ts";

export const pacedHost = host.trait("configuration", "GitHub pacing delays the daemon until its budget resets", function* (engine) {
	engine.scheduled = true;
	engine.config = { ...engine.config, intervalSeconds: 0.05 };
	const github = syntheticGithub({ remaining: 1000, reset: Math.ceil((yield* Clock.currentTimeMillis) / 1000) + 3600 });
	github.reply("repos/example/repository", {});
	const layer = Layer.effect(GithubApi)(
		Effect.gen(function* () {
			const paused = yield* Deferred.make<void>();
			engine.schedulerPaused = Deferred.await(paused);
			const api = yield* GithubApi;
			yield* api.get("repos/example/repository").pipe(Effect.orDie);
			return { ...api, pace: (interval: number) => api.pace(interval).pipe(Effect.tap(() => Deferred.succeed(paused, undefined))) };
		}),
	).pipe(Layer.provide(github.layer));
	engine.parts = { ...engine.parts, github: layer };
});
