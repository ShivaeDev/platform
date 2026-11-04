import { HttpClient } from "effect/http";
import { defineService } from "@shivaedev/service/defineService.ts";
import { GitHubAppCredentials } from "#GitHubAppCredentials.ts";
import { GitHubConfig } from "#GitHubConfig.ts";
import { initializeGitHubApp } from "#initializeGitHubApp.ts";
import { installation } from "#operations/installation.ts";
import { viewerRepositories } from "#operations/viewerRepositories.ts";

export const GitHubApp = defineService({
	id: "@shivaedev/github/GitHubApp",
	initialize: initializeGitHubApp,
	methods: ({ clients, viewers }) => ({ installation: installation(clients), viewerRepositories: viewerRepositories(viewers) }),
	requires: [GitHubAppCredentials, HttpClient.HttpClient, GitHubConfig],
});
