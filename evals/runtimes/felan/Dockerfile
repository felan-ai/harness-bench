# syntax=docker/dockerfile:1
FROM node:22.20.0-trixie-slim@sha256:f3bca16c4b87ad0c7abfad97f6803898ee9b08a1f153a269140f0a08f50231d2 AS base

ARG PNPM_VERSION=9.15.5
ARG RTK_VERSION=0.45.0
ARG RTK_INSTALLER_COMMIT=b34be37caf3796b69a50952a28e60e32b5daad43
ARG RTK_INSTALLER_SHA256=d6eb73a772903e13ff34ee1be8a8b24e896ba9a978f20d2279a08b4083ea6f77
ARG CA_CERTIFICATES_VERSION=20250419
ARG CURL_VERSION=8.14.1-2+deb13u4
ARG GIT_VERSION=1:2.47.3-0+deb13u1

LABEL org.harness-bench.runtime="felan-v1"
LABEL org.harness-bench.source-commit="104faa5559029c8be9e8a1eb504d87974a5864e9"
LABEL org.harness-bench.dependency-lock-sha256="c66b8b536006ad83c9f571f9f2c14a623bb24d11fbc5e1e863b30b3c14831ba6"
LABEL org.harness-bench.rtk-version="${RTK_VERSION}"

ENV RTK_TELEMETRY_DISABLED=1

RUN apt-get update \
  && apt-get install --yes --no-install-recommends \
    "ca-certificates=${CA_CERTIFICATES_VERSION}" \
    "curl=${CURL_VERSION}" \
    "git=${GIT_VERSION}" \
  && rm -rf /var/lib/apt/lists/*

RUN npm install --global "pnpm@${PNPM_VERSION}" \
  && npm cache clean --force

RUN curl --proto '=https' --tlsv1.2 --fail --silent --show-error --location \
    --max-filesize 65536 \
    "https://raw.githubusercontent.com/rtk-ai/rtk/${RTK_INSTALLER_COMMIT}/install.sh" \
    --output /tmp/install-rtk.sh \
  && printf '%s  %s\n' "${RTK_INSTALLER_SHA256}" /tmp/install-rtk.sh \
    | sha256sum --check --strict - \
  && RTK_VERSION="v${RTK_VERSION}" RTK_INSTALL_DIR=/usr/local/bin \
    /bin/sh /tmp/install-rtk.sh \
  && test "$(rtk --version)" = "rtk ${RTK_VERSION}" \
  && rm /tmp/install-rtk.sh

FROM base AS dependency-cache

WORKDIR /opt/harness-deps/felan
COPY evals/runtimes/felan/context/.npmrc ./
COPY evals/runtimes/felan/context/pnpm-lock.yaml ./
COPY evals/runtimes/felan/context/pnpm-workspace.yaml ./
RUN --mount=type=cache,id=harness-bench-felan-pnpm,target=/root/.local/share/pnpm/store \
  pnpm fetch --frozen-lockfile --store-dir /opt/harness-deps/felan-store

FROM base

COPY --from=dependency-cache /opt/harness-deps/felan-store /opt/harness-deps/felan-store

ENV SHELL=/bin/bash

WORKDIR /workspace
