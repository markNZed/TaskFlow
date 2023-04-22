FROM node:18-buster-slim

WORKDIR /app

RUN apt-get update && \
    apt-get upgrade -y && \
    apt-get install -y bash git python3 python3-pip python3-dev build-essential screen procps vim

EXPOSE 3000
EXPOSE 5000

COPY entrypoint.sh /entrypoint.sh
RUN chmod 755 /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
