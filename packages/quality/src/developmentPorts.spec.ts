import { assertThat } from "@shivaedev/test-kits/quality/adapters/assertThat.ts";
import { environmentPorts, viteConfig } from "#test/viteConfig.ts";

for (const { name, env, options, webPort, apiPort } of [
	{ apiPort: 3000, env: {}, name: "defaults", options: {}, webPort: 5173 },
	{ apiPort: 3100, env: { "PORT": "3100", "VITE_PORT": "5273" }, name: "environment ports", options: {}, webPort: 5273 },
	{
		apiPort: 3200,
		env: { "PORT": "3100", "VITE_PORT": "5273" },
		name: "explicit ports over environment ports",
		options: { apiPort: 3200, webPort: 5373 },
		webPort: 5373,
	},
	{ apiPort: 3100, env: { "PORT": "3100" }, name: "an explicit web port with the environment API port", options: { webPort: 5373 }, webPort: 5373 },
	{ apiPort: 3200, env: {}, name: "an explicit API port with the default web port", options: { apiPort: 3200 }, webPort: 5173 },
]) {
	viteConfig.it(`the app uses ${name} for its web server and every API proxy`, [environmentPorts(env)], function* ({ build, ports }) {
		yield* build(options);

		const actual = yield* ports();
		yield* assertThat(actual, (value) =>
			value.toEqual({
				proxyTargets: {
					"/api/auth": `http://127.0.0.1:${apiPort}`,
					"/health": `http://127.0.0.1:${apiPort}`,
					"/rpc": `http://127.0.0.1:${apiPort}`,
				},
				serverPort: webPort,
			}),
		);
	});
}
