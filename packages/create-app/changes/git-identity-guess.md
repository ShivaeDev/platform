### Fixed

- Creating an app without a configured Git identity no longer stalls for seconds while Git guesses an email from the host name. The initial commit uses the Create App identity unless Git's `user.name` and `user.email` settings or the `GIT_AUTHOR_*` variables provide one; `EMAIL` and host-name guesses no longer count.
