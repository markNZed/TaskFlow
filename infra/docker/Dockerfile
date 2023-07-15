FROM node:18-buster-slim

RUN apt-get update && \
    apt-get upgrade -y && \
    apt-get install -y bash git python3 python3-pip python3-dev build-essential screen procps vim wget net-tools curl && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN wget -qO /usr/local/bin/websocat https://github.com/vi/websocat/releases/latest/download/websocat.x86_64-unknown-linux-musl
RUN chmod a+x /usr/local/bin/websocat
#websocat --version

# Install Nodemon, ESLint, Prettier, and Jest
RUN yarn global add nodemon eslint prettier jest

WORKDIR /app

# Install TypeScript
RUN npm install -g typescript

EXPOSE 3000
EXPOSE 5000
EXPOSE 5001
EXPOSE 5002

COPY entrypoint.sh /entrypoint.sh
RUN chmod 755 /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
