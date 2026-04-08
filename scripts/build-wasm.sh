#!/usr/bin/env bash
# Build WASM modules for postflop-solver integration.
#
# Prerequisites:
#   1. Install Rust nightly: rustup install nightly
#   2. Add WASM target: rustup target add wasm32-unknown-unknown --toolchain nightly
#   3. Install wasm-pack: cargo install wasm-pack
#
# This script builds two WASM modules:
#   - range: RangeManager for parsing PioSOLVER-format ranges
#   - solver-st: Single-threaded GameManager for solving postflop spots
#
# Usage: bash scripts/build-wasm.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
WASM_DIR="$PROJECT_ROOT/wasm"
PKG_DIR="$WASM_DIR/pkg"

echo "=== EV-Trainer WASM Build ==="
echo ""

# Check prerequisites
command -v rustup >/dev/null 2>&1 || { echo "ERROR: rustup not found. Install from https://rustup.rs"; exit 1; }
command -v wasm-pack >/dev/null 2>&1 || { echo "ERROR: wasm-pack not found. Install with: cargo install wasm-pack"; exit 1; }

echo "Rust version: $(rustc +nightly --version)"
echo "wasm-pack version: $(wasm-pack --version)"
echo ""

# Check if solver source exists
SOLVER_SRC="$WASM_DIR/postflop-solver"
if [ ! -d "$SOLVER_SRC" ]; then
  echo "Solver source not found at $SOLVER_SRC"
  echo ""
  echo "To set up:"
  echo "  1. Fork https://github.com/b-inary/postflop-solver"
  echo "  2. Clone into wasm/postflop-solver:"
  echo "     git clone https://github.com/YOUR_USERNAME/postflop-solver.git wasm/postflop-solver"
  echo ""
  echo "  Also clone the WASM wrapper:"
  echo "     git clone https://github.com/YOUR_USERNAME/wasm-postflop.git wasm/wasm-postflop"
  exit 1
fi

WASM_SRC="$WASM_DIR/wasm-postflop"
if [ ! -d "$WASM_SRC" ]; then
  echo "WASM wrapper not found at $WASM_SRC"
  echo "Clone: git clone https://github.com/b-inary/wasm-postflop.git wasm/wasm-postflop"
  exit 1
fi

# Build range module (web target for Worker + test compatibility)
echo "Building range module..."
cd "$WASM_SRC"
wasm-pack build --target web --out-dir "$PKG_DIR/range" rust/range
echo "  Done."

# Build solver-st module (web target for Worker loading)
echo "Building solver-st module (single-threaded)..."
wasm-pack build --target web --out-dir "$PKG_DIR/solver-st" rust/solver-st
echo "  Done."

echo ""
echo "=== Build Complete ==="
echo "Modules written to: $PKG_DIR/"
ls -la "$PKG_DIR/range/" 2>/dev/null || true
ls -la "$PKG_DIR/solver-st/" 2>/dev/null || true
