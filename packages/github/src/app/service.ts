import { defineService } from "@shivaedev/service/defineService.ts";
import { GitHubClients } from "#GitHubClients.ts";
import { initializeGitHubApp } from "#initializeGitHubApp.ts";
import { installation } from "./installation.ts";
import { viewerRepositories } from "./viewerRepositories.ts";

export const GitHubApp = defineService({
	id: "@shivaedev/github/GitHubApp",
	initialize: initializeGitHubApp,
	methods: (viewers) => ({ installation, viewerRepositories: viewerRepositories(viewers) }),
	requires: [GitHubClients],
});
