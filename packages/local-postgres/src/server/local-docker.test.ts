import { execFileSync } from "node:child_process";
import { afterEach, expect, it, vi } from "vitest";
import { docker } from "#local-docker.ts";
import { dockerScript } from "#test/dockerScript.ts";

vi.mock("node:child_process", () => ({ execFileSync: vi.fn() }));
afterEach(() => vi.mocked(execFileSync).mockReset());

it("accepts local Unix, Windows pipe and loopback TCP Docker endpoints", () => {
	for (const host of [
		"unix:///var/run/docker.sock",
		"npipe:////./pipe/docker_engine",
		"tcp://localhost:2375",
		"tcp://127.0.0.1:2375",
		"tcp://[::1]:2375",
	]) {
		const script = dockerScript([{ args: ["info"], result: "local Docker" }]);
		vi.mocked(execFileSync).mockImplementation((file, args) => {
			expect(file).toBe("docker");
			return script.run(args ?? []);
		});
		expect(() => {
			expect(docker({ "DOCKER_HOST": host }, ["info"])).toBe("local Docker");
		}).not.toThrow();
		script.done();
	}
});

it("resolves the active context and gives an explicit context precedence over DOCKER_HOST", () => {
	for (const context of [undefined, "desktop-linux"]) {
		const script = dockerScript([
			{
				args: ["context", "inspect", ...(context ? [context] : []), "--format", "{{.Endpoints.docker.Host}}"],
				result: "unix:///var/run/docker.sock\n",
			},
			{ args: ["info"], result: "local Docker" },
		]);
		vi.mocked(execFileSync).mockImplementation((file, args) => {
			expect(file).toBe("docker");
			return script.run(args ?? []);
		});
		expect(() => {
			expect(docker(context ? { "DOCKER_CONTEXT": context, "DOCKER_HOST": "ssh://remote.example" } : {}, ["info"])).toBe("local Docker");
		}).not.toThrow();
		script.done();
	}
});

it("refuses a remote endpoint selected by a named Docker context", () => {
	const script = dockerScript([
		{ args: ["context", "inspect", "remote", "--format", "{{.Endpoints.docker.Host}}"], result: "tcp://remote.example:2376\n" },
	]);
	vi.mocked(execFileSync).mockImplementation((file, args) => {
		expect(file).toBe("docker");
		return script.run(args ?? []);
	});
	expect(() => docker({ "DOCKER_CONTEXT": "remote", "DOCKER_HOST": "unix:///var/run/docker.sock" }, ["info"])).toThrow(
		"Local database setup requires a local Docker endpoint; remote contexts are refused.",
	);
	script.done();
});
