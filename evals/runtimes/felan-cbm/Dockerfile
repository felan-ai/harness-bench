# syntax=docker/dockerfile:1
FROM node:22.20.0-trixie-slim@sha256:f3bca16c4b87ad0c7abfad97f6803898ee9b08a1f153a269140f0a08f50231d2 AS base

ARG PNPM_VERSION=9.15.5
ARG CBM_VERSION=0.10.8
ARG CBM_AMD64_SHA256=6eef49652bc0c7820f43114125044d40bf7f4d97c11b2592f6b0f6a307702325
ARG CBM_ARM64_SHA256=5697d986d9716c913163b4bff7b3a294287f3b843e993bc1ff71e78dcdc21781
ARG CA_CERTIFICATES_VERSION=20250419
ARG CURL_VERSION=8.14.1-2+deb13u4
ARG GIT_VERSION=1:2.47.3-0+deb13u1

LABEL org.harness-bench.runtime="felan-cbm-v1"
LABEL org.harness-bench.source-commit="7ae8f94e72095a8bc38bf62b902164d2717f3294"
LABEL org.harness-bench.dependency-lock-sha256="7b750a72f6330dd5fa0700105e78aaecd360dd496848ac96ec3e5248d5b9eb01"
LABEL org.harness-bench.cbm-version="${CBM_VERSION}"

ENV RTK_TELEMETRY_DISABLED=1

RUN apt-get update \
  && apt-get install --yes --no-install-recommends \
    "ca-certificates=${CA_CERTIFICATES_VERSION}" \
    "curl=${CURL_VERSION}" \
    "git=${GIT_VERSION}" \
  && rm -rf /var/lib/apt/lists/*

RUN npm install --global "pnpm@${PNPM_VERSION}" \
  && npm cache clean --force

# Bake the codebase-memory-mcp binary in at image build time so the
# `felan-cbm-on` arm does not pay a ~30s install cost at session start.
RUN set -eux; \
    case "$(dpkg --print-architecture)" in \
      amd64) ARCHIVE="codebase-memory-mcp-linux-amd64-portable.tar.gz"; SHA="$CBM_AMD64_SHA256" ;; \
      arm64) ARCHIVE="codebase-memory-mcp-linux-arm64-portable.tar.gz"; SHA="$CBM_ARM64_SHA256" ;; \
      *) echo "Unsupported architecture" >&2; exit 1 ;; \
    esac; \
    curl --proto '=https' --tlsv1.2 --fail --silent --show-error --location \
      --output /tmp/cbm.tar.gz \
      "https://github.com/DeusData/codebase-memory-mcp/releases/download/v${CBM_VERSION}/${ARCHIVE}"; \
    printf '%s  %s\n' "${SHA}" /tmp/cbm.tar.gz | sha256sum --check --strict -; \
    tar -xzf /tmp/cbm.tar.gz -C /usr/local/bin codebase-memory-mcp; \
    chmod 0755 /usr/local/bin/codebase-memory-mcp; \
    test "$(codebase-memory-mcp --version)" = "codebase-memory-mcp ${CBM_VERSION}"; \
    rm /tmp/cbm.tar.gz

FROM base AS dependency-cache

WORKDIR /opt/harness-deps/felan-cbm
COPY evals/runtimes/felan-cbm/context/.npmrc ./
COPY evals/runtimes/felan-cbm/context/pnpm-lock.yaml ./
COPY evals/runtimes/felan-cbm/context/pnpm-workspace.yaml ./
RUN --mount=type=cache,id=harness-bench-felan-cbm-pnpm,target=/root/.local/share/pnpm/store \
  pnpm fetch --frozen-lockfile --store-dir /opt/harness-deps/felan-cbm-store

FROM base

COPY --from=dependency-cache /opt/harness-deps/felan-cbm-store /opt/harness-deps/felan-cbm-store

ENV SHELL=/bin/bash

WORKDIR /workspace
