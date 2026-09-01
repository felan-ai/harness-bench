# syntax=docker/dockerfile:1
FROM node:22.20.0-trixie-slim@sha256:f3bca16c4b87ad0c7abfad97f6803898ee9b08a1f153a269140f0a08f50231d2

ARG PNPM_VERSION=9.15.5
ARG RTK_VERSION=0.45.0
ARG RTK_INSTALLER_COMMIT=b34be37caf3796b69a50952a28e60e32b5daad43
ARG RTK_INSTALLER_SHA256=d6eb73a772903e13ff34ee1be8a8b24e896ba9a978f20d2279a08b4083ea6f77
ARG PYTHON_VERSION=3.13.5-1
ARG PYTHON_RUNTIME_VERSION=3.13.5-2+deb13u4
ARG MARKITDOWN_VERSION=0.1.7
ARG MARKITDOWN_REQUIREMENTS_SHA256=1c76ebede61f8df9d8d0264184fc70fffc6fea8b68cef04e563b828c2d70d7fe
ARG CA_CERTIFICATES_VERSION=20250419
ARG CURL_VERSION=8.14.1-2+deb13u4
ARG GIT_VERSION=1:2.47.3-0+deb13u1

LABEL org.harness-bench.runtime="felan-v1"
LABEL org.harness-bench.rtk-version="${RTK_VERSION}"
LABEL org.harness-bench.markitdown-version="${MARKITDOWN_VERSION}"
LABEL org.harness-bench.markitdown-requirements-sha256="${MARKITDOWN_REQUIREMENTS_SHA256}"

ENV RTK_TELEMETRY_DISABLED=1

RUN apt-get update \
  && apt-get install --yes --no-install-recommends \
    "ca-certificates=${CA_CERTIFICATES_VERSION}" \
    "curl=${CURL_VERSION}" \
    "git=${GIT_VERSION}" \
    "python3=${PYTHON_VERSION}" \
    "python3-venv=${PYTHON_VERSION}" \
    "python3.13=${PYTHON_RUNTIME_VERSION}" \
    "python3.13-venv=${PYTHON_RUNTIME_VERSION}" \
  && rm -rf /var/lib/apt/lists/*

RUN npm install --global "pnpm@${PNPM_VERSION}" \
  && npm cache clean --force

COPY evals/runtimes/felan/markitdown-requirements.txt /tmp/markitdown-requirements.txt
RUN test "$(tr -d '\r' < /tmp/markitdown-requirements.txt | sha256sum | cut -d ' ' -f 1)" = "${MARKITDOWN_REQUIREMENTS_SHA256}" \
  && python3 -m venv /opt/markitdown \
  && /opt/markitdown/bin/pip install --no-cache-dir --require-hashes -r /tmp/markitdown-requirements.txt \
  && test "$(/opt/markitdown/bin/markitdown --version)" = "markitdown ${MARKITDOWN_VERSION}"

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

ENV PATH="/opt/markitdown/bin:${PATH}" \
    SHELL=/bin/bash

WORKDIR /workspace
