.PHONY: setup

setup:
	@echo "Checking prerequisites..."
	@command -v node >/dev/null 2>&1 || { echo "Installing Node.js..."; brew install node; }
	@NODE_VERSION=$$(node -v | sed 's/v//' | cut -d. -f1); \
	if [ "$$NODE_VERSION" -lt 22 ]; then \
		echo "Node.js v22.5+ required (found $$(node -v)). Upgrading..."; \
		brew upgrade node; \
	fi
	@command -v pnpm >/dev/null 2>&1 || { echo "Installing pnpm..."; npm install -g pnpm; }
	@command -v tmux >/dev/null 2>&1 || { echo "Installing tmux..."; brew install tmux; }
	@echo "Installing dependencies..."
	@pnpm install
	@echo "Linking zanki command..."
	@pnpm link --global
	@echo "Setup complete. Run 'zanki' to start."
