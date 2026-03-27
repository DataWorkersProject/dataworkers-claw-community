# Homebrew Formula for Data Workers (dw-claw)

## Quick Install

```bash
brew tap DataWorkersProject/tap
brew install data-workers
```

## What Gets Installed

- `dw-claw` -- primary CLI binary for the Data Workers agent swarm
- `data-workers` -- alias for `dw-claw`

## Tap Repository Setup

To publish this formula via a Homebrew tap, create a repository named
`homebrew-tap` under the `DataWorkersProject` GitHub account and copy
`data-workers.rb` into the `Formula/` directory:

```
homebrew-tap/
  Formula/
    data-workers.rb
```

## Updating the Formula

1. Tag a new release on `dataworkers-claw-community` (e.g. `v0.2.0`).
2. Download the tarball and compute the SHA256:
   ```bash
   curl -sL https://github.com/DataWorkersProject/dataworkers-claw-community/archive/refs/tags/v0.2.0.tar.gz | shasum -a 256
   ```
3. Update `version` and `sha256` in `data-workers.rb`.
4. Push to the `homebrew-tap` repository.

## Dependencies

- Node.js 20+ (installed automatically via `node@20` Homebrew dependency)
