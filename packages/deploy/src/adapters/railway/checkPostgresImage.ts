import { postgresCmd, postgresEntrypoint } from "./postgresStartCommand.ts";

export async function checkPostgresImage(image: string) {
	try {
		const [repository, tag] = image.replace("ghcr.io/", "").split(":");
		const tokenResponse = await readJson(`https://ghcr.io/token?service=ghcr.io&scope=repository:${repository}:pull`);
		if (typeof tokenResponse.token !== "string") {
			throw new Error("Registry returned no pull token");
		}
		const headers = {
			Accept:
				"application/vnd.oci.image.index.v1+json, application/vnd.docker.distribution.manifest.list.v2+json, application/vnd.oci.image.manifest.v1+json, application/vnd.docker.distribution.manifest.v2+json",
			Authorization: `Bearer ${tokenResponse.token}`,
		};
		const base = `https://ghcr.io/v2/${repository}`;
		const manifest = await readJson(`${base}/manifests/${tag}`, headers);
		const platforms = Array.isArray(manifest.manifests)
			? manifest.manifests.filter(isRecord).filter(({ platform }) => isRecord(platform) && platform.os === "linux")
			: undefined;
		const manifests = platforms ? await Promise.all(platforms.map(({ digest }) => readImageJson(base, "manifests", digest, headers))) : [manifest];
		if (manifests.length === 0) {
			throw new Error("No Linux image manifests found");
		}
		for (const entry of manifests) {
			if (!isRecord(entry.config)) {
				throw new Error("Image manifest has no config digest");
			}
			const blob = await readImageJson(base, "blobs", entry.config.digest, headers);
			const config = blob.config;
			if (!isRecord(config)) {
				throw new Error("Image config has no startup metadata");
			}
			if (JSON.stringify(config.Entrypoint) !== JSON.stringify(postgresEntrypoint) || JSON.stringify(config.Cmd) !== JSON.stringify(postgresCmd)) {
				throw new Error(
					`Expected ENTRYPOINT ${JSON.stringify(postgresEntrypoint)} and CMD ${JSON.stringify(postgresCmd)}; received ENTRYPOINT ${JSON.stringify(config.Entrypoint)} and CMD ${JSON.stringify(config.Cmd)}. Revise the page-cache trim startup chain before deploying.`,
				);
			}
		}
	} catch (cause) {
		throw new Error(
			`Cannot deploy Postgres image ${image}: startup chain verification failed: ${cause instanceof Error ? cause.message : String(cause)}`,
			{ cause },
		);
	}
}

function readImageJson(base: string, kind: string, digest: unknown, headers: Record<string, string>) {
	if (typeof digest !== "string") {
		throw new Error("Registry descriptor has no image digest");
	}
	return readJson(`${base}/${kind}/${digest}`, headers);
}

async function readJson(url: string, headers: Record<string, string> = {}) {
	const response = await fetch(url, { headers });
	if (!response.ok) {
		throw new Error(`Registry request ${url} failed: HTTP ${response.status}`);
	}
	const value: unknown = await response.json();
	if (!isRecord(value)) {
		throw new Error(`Registry response ${url} is not a JSON object`);
	}
	return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
