FROM alpine:latest

ENV APP_NAME=app

WORKDIR /root

# for debugging
RUN apk add fuse3 && \
  apk update && \
  apk upgrade && \
  apk add --no-cache bash sqlite

COPY --from=flyio/litefs:0.4 /usr/local/bin/litefs /usr/local/bin/litefs

RUN mkdir -p /root/litefs

RUN touch /root/litefs/$APP_NAME.db

COPY ./scripts/litefs.yml /etc/litefs.yml

COPY ./scripts/start.sh /root/start.sh

RUN chmod +x /root/start.sh

CMD ["/root/start.sh"]
