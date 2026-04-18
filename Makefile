.PHONY: setup

setup:
	@echo "Checking prerequisites..."
	@command -v mise >/dev/null 2>&1 || { echo "Installing mise..."; brew install mise; }
	@echo "Installing Node.js via mise..."
	@mise install
	@command -v pnpm >/dev/null 2>&1 || { echo "Installing pnpm..."; npm install -g pnpm; }
	@command -v tmux >/dev/null 2>&1 || { echo "Installing tmux..."; brew install tmux; }
	@echo "Installing dependencies..."
	@pnpm install
	@echo "Rebuilding native modules (node-pty) for current Node version..."
	@pnpm rebuild
	@echo "Linking plx command..."
	@pnpm link --global
	@echo "Setup complete. Run 'plx' to start."
