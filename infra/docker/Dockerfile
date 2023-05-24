FROM node:18-buster-slim

WORKDIR /app

RUN apt-get update && \
    apt-get upgrade -y && \
    apt-get install -y bash git python3 python3-pip python3-dev build-essential screen procps vim wget

RUN wget -qO /usr/local/bin/websocat https://github.com/vi/websocat/releases/latest/download/websocat.x86_64-unknown-linux-musl
RUN chmod a+x /usr/local/bin/websocat
#websocat --version

RUN apt-get install -y net-tools

EXPOSE 3000
EXPOSE 5000
EXPOSE 5001

COPY entrypoint.sh /entrypoint.sh
RUN chmod 755 /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
