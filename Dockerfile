# Build aurora from source with the ChatGPT (codex) OAuth client id patched in,
# so it can refresh the codex-issued refresh token natively.
FROM golang:1.26-alpine AS build
RUN apk add --no-cache git ca-certificates
RUN git clone --depth 1 https://github.com/aurora-develop/aurora /src
WORKDIR /src
# Patch the OAuth client id + redirect uri to match the codex-issued token.
RUN sed -i 's/pdlLIX2Y72MIl2rhLhTE9VV9bN905kBh/app_EMoamEEZ73f0CkXaXp7hrann/g' internal/chatgpt/auth.go
RUN sed -i 's#com.openai.chat://auth.openai.com/ios/com.openai.chat/callback#http://localhost:1455/auth/callback#g' internal/chatgpt/auth.go
ENV CGO_ENABLED=0
RUN go build -trimpath -ldflags='-s -w -buildid=' -o /out/aurora .

FROM alpine:3.20
RUN apk add --no-cache ca-certificates tzdata
COPY --from=build /out/aurora /usr/local/bin/aurora
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
WORKDIR /data
EXPOSE 10000
ENTRYPOINT ["/entrypoint.sh"]
