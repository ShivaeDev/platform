import { defineService } from "@shivaedev/service/defineService.ts";
import { installation } from "#app/installation.ts";
import { viewerRepositories } from "#app/viewerRepositories.ts";
import { GitHubClients } from "#GitHubClients.ts";
import { initializeGitHubApp } from "#initializeGitHubApp.ts";

export const GitHubApp = defineService({
	id: "@shivaedev/github/GitHubApp",
	initialize: initializeGitHubApp,
	methods: (viewers) => ({ installation, viewerRepositories: viewerRepositories(viewers) }),
	requires: [GitHubClients],
});
