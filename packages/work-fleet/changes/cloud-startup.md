### Fixed

- Cloud worker and reviewer startup instructions use login-shell environment activation, with a single fallback when Node does not match `.node-version`. Code workers run `./script/update` immediately after fetching and creating their branch; report workers run it before executing repository commands.
