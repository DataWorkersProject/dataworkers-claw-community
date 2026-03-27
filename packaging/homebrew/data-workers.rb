# Homebrew formula for Data Workers CLI (dw-claw).
#
# Install:  brew install DhanushAShetty/tap/data-workers
# Usage:    dw-claw init | list | status
#           data-workers init | list | status

class DataWorkers < Formula
  desc "Open-source autonomous agent swarm for data engineering"
  homepage "https://github.com/DhanushAShetty/dw-claw"
  url "https://github.com/DhanushAShetty/dw-claw/archive/refs/tags/v#{version}.tar.gz"
  version "0.1.0"
  # TODO: Update SHA256 when v0.1.0 is tagged and release tarball is available
  sha256 "0000000000000000000000000000000000000000000000000000000000000000"
  license "Apache-2.0"

  depends_on "node@20"

  def install
    # Install root workspace dependencies (production only)
    system "npm", "ci", "--production", "--ignore-scripts"

    # Build the CLI package
    cd "packages/cli" do
      system "npm", "run", "build"
    end

    # Copy everything into libexec
    libexec.install Dir["*"]

    # Create wrapper scripts that invoke the CLI via the correct Node binary
    (bin/"data-workers").write <<~EOS
      #!/bin/bash
      exec "#{Formula["node@20"].opt_bin}/node" "#{libexec}/packages/cli/dist/index.js" "$@"
    EOS

    (bin/"dw-claw").write <<~EOS
      #!/bin/bash
      exec "#{Formula["node@20"].opt_bin}/node" "#{libexec}/packages/cli/dist/claw.js" "$@"
    EOS
  end

  def caveats
    <<~EOS
      Data Workers CLI has been installed.

      Quick start:
        dw-claw init      # Generate .mcp.json config
        dw-claw list      # List available agents
        dw-claw status    # Check agent health

      The `data-workers` command is also available as an alias.

      To run the full agent swarm with Docker:
        cd #{libexec}
        docker compose -f docker/docker-compose.agents.yml up -d

      Documentation: https://github.com/DhanushAShetty/dw-claw
    EOS
  end

  test do
    # Verify both binaries exist and are executable
    assert_predicate bin/"data-workers", :executable?
    assert_predicate bin/"dw-claw", :executable?

    # Verify node can load the entry point (--version or --help)
    output = shell_output("#{bin}/dw-claw --help 2>&1", 0)
    assert_match(/data.workers|dw.claw|usage|help/i, output)
  end
end
