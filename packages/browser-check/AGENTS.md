# @shivaedev/browser-check

Give agents and developers a quick local view of an already running app, with screenshots and a few smoke checks. Keep the command opt-in and install Chromium only when it runs. App stories prove behavior; private apps must not pay CI minutes for browser end-to-end suites.

Prefer a small CLI over a test framework. Keep Playwright at the adapter boundary and browser lifetimes scoped. Credentials belong in the local environment and screenshots in ignored local output. See the [README](README.md) for usage and the [root guidance](../../AGENTS.md) for repository rules.
