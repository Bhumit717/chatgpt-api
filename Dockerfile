FROM ghcr.io/aurora-develop/aurora:latest AS aurora

FROM alpine:3.20
RUN apk add --no-cache ca-certificates tzdata
COPY --from=aurora /aurora /usr/local/bin/aurora
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
WORKDIR /data
EXPOSE 8080
ENTRYPOINT ["/entrypoint.sh"]
