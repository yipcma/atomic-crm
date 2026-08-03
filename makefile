.PHONY: build help

# Run silently, show output on failure
run-silent = $1 >/tmp/atomic-crm-$2.log 2>&1 || (cat /tmp/atomic-crm-$2.log && false)

# Same but captures TTY output (for docker/supabase)
ifeq ($(shell uname),Darwin)
run-silent-tty = script -q /tmp/atomic-crm-$2.log $1 >/dev/null 2>&1 || (cat /tmp/atomic-crm-$2.log && false)
else
run-silent-tty = script -eq /dev/null -c "$1" >/tmp/atomic-crm-$2.log 2>&1 || (cat /tmp/atomic-crm-$2.log && false)
endif

help:
	@grep -E '^[a-zA-Z0-9_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}'

install: package.json ## install dependencies
	npm install

install-playwright-browsers: install ## install the playwright browsers matching the repo's pinned version
	npx playwright install chromium chromium-headless-shell

install-claude-plugins:
	claude plugin marketplace update claude-plugins-official
	claude plugin install typescript-lsp@claude-plugins-official

install-lsp:
	npm install -g typescript-language-server

start-supabase: ## start supabase locally
	npx supabase start

start-supabase-functions: ## start the supabase Functions watcher
	npx supabase functions serve

supabase-migrate-database: ## apply the migrations to the database
	npx supabase migration up

supabase-reset-database: ## reset (and clear!) the database
	npx supabase db reset

start-app: ## start the app locally
	npm run dev

# Order matters. The API asserts at boot that every exposed resource is
# tenant-scoped, so it refuses to start against an unmigrated database -- the
# migrations must run BEFORE the api container, not after it. Everything also
# has to agree on ONE database: the api, the migration, and the suite's own
# reset/seed all use `crm`.
e2e-up: ## bring up the real e2e stack (postgres + api + the built SPA behind Caddy)
	docker compose up -d db --wait
	DATABASE_URL=postgres://crm:crm@localhost:5432/crm JWT_SECRET=e2e-secret npm --prefix server run migrate
	docker compose --profile e2e up -d --build --wait

e2e-down: ## tear down the e2e stack and its volumes
	docker compose --profile e2e down -v

build: ## build the app
	npm run build

build-e2e: ## build the app in e2e mode (with the e2e supabase config)
	@$(call run-silent,npm run build:e2e,build-e2e)


prod-start: build supabase-deploy
	open http://127.0.0.1:3000 && npx serve -l tcp://127.0.0.1:3000 dist

prod-deploy: build supabase-deploy
	npm run ghpages:deploy

supabase-remote-init:
	npm run supabase:remote:init
	$(MAKE) supabase-deploy

supabase-deploy:
	npx supabase db push
	npx supabase functions deploy

test-unit: test-app test-functions 

test: test-unit

test-app:
	npm run test:unit:app

test-functions:
	npm run test:unit:functions

# `docker compose --wait` already blocks on the healthchecks, so the previous
# wait-on step against the Supabase auth endpoint is gone along with Supabase.
# Reset goes through the db CONTAINER's psql rather than a host one, so neither
# a developer machine nor the CI runner image needs postgresql-client installed.
E2E_PSQL_CMD = docker compose exec -T db psql -U crm -d crm

test-e2e: e2e-up ## run the e2e suite interactively against the real stack
	E2E_PSQL="$(E2E_PSQL_CMD)" npx playwright test --ui

test-e2e-ci: e2e-up ## run the e2e suite against the real stack
	E2E_PSQL="$(E2E_PSQL_CMD)" npx playwright test

lint:
	npm run lint
	npm run prettier

publish:
	npm publish

typecheck:
	npm run typecheck

doc-install:
	@(cd doc && npm install)

doc: doc-dev

doc-dev:
	@(cd doc && npm run dev)

doc-build:
	@(cd doc && npm run build)

doc-preview: doc-build
	@(cd doc && npm run preview)

doc-deploy:
	@(cd doc && npx gh-pages -b gh-pages -d dist -e doc -m "Deploy docs" --remove doc)

registry-build: ## build the shadcn registry
	npm run registry:build

registry-deploy: registry-build ## Deploy the shadcn registry (Automatically done by CI/CD pipeline)
	@(cd public/r && npx gh-pages -b gh-pages -d ./ -s atomic-crm.json -e r -m "Deploy registry" --remove r)

registry-gen: ## Generate the shadcn registry (ran automatically by a pre-commit hook)
	npm run registry:gen
	npx prettier --config ./.prettierrc.json --write "registry.json"

update-changelog: ## Update the changelog with the unreleased changes (ran automatically by a pre-commit hook)
	npm run update-changelog
	npx prettier --config ./.prettierrc.json --write "CHANGELOG.md"

storybook: ## start storybook
	npm run storybook

watch: ## live monitor of the most recent agent session (agents, hooks, diagnosis)
	node scripts/harness-monitor.mjs --watch

monitor: ## one-shot summary of the most recent agent session (pass SESSION=<id> to pick one)
	@node scripts/harness-monitor.mjs $(if $(SESSION),--session $(SESSION),)

sessions: ## list known agent sessions, newest first
	@node scripts/harness-monitor.mjs --list
