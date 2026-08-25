# syntax=docker/dockerfile:1
FROM node:22.20.0-bookworm-slim@sha256:b21fe589dfbe5cc39365d0544b9be3f1f33f55f3c86c87a76ff65a02f8f5848e

ARG PNPM_VERSION=9.15.5

LABEL org.harness-bench.runtime="storzy-v1"
LABEL org.harness-bench.fixture-lock-sha256="c01689b6865df2cab95caed781a6b3387cd1aed93318e9963a5fc990beab6b08"

RUN npm install --global "pnpm@${PNPM_VERSION}" \
  && npm cache clean --force

WORKDIR /opt/harness-deps/storzy
COPY evals/fixtures/storzy/v1/source/package.json ./package.json
COPY evals/fixtures/storzy/v1/source/pnpm-lock.yaml ./pnpm-lock.yaml
RUN --mount=type=cache,id=harness-bench-storzy-pnpm,target=/root/.local/share/pnpm/store \
  pnpm install --frozen-lockfile

WORKDIR /workspace
