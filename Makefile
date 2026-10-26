.PHONY: help up down restart build logs migrate seed test demo clean

help:
	@echo "RoktoBondhu (রক্তবন্ধু) — Available Commands:"
	@echo "  make up        - Start full Docker Compose stack (services, databases, gateway)"
	@echo "  make down      - Stop and remove Docker containers"
	@echo "  make restart   - Restart all Docker containers"
	@echo "  make build     - Build all multi-stage Docker container images"
	@echo "  make logs      - View logs across all services"
	@echo "  make migrate   - Run PostgreSQL database migrations"
	@echo "  make seed      - Seed 15 volunteer donors across Dhaka"
	@echo "  make test      - Run full unit, domain, and integration test suites"
	@echo "  make demo      - Run interactive emergency request & matching wave demo"

up:
	docker compose up -d

down:
	docker compose down

restart:
	docker compose restart

build:
	docker compose build

logs:
	docker compose logs -f

migrate:
	npm run migrate

seed:
	npm run seed:donors

test:
	npm test

demo:
	node scripts/demo.js
