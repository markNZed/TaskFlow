FROM node:18-buster-slim

# Set bash as the default shell
SHELL ["/bin/bash", "-c"]
ENV SHELL /bin/bash
RUN chsh -s /bin/bash

RUN apt-get update && \
    apt-get upgrade -y && \
    apt-get install -y bash git python3 python3-pip python3-dev build-essential screen procps vim wget net-tools curl iputils-ping redis-tools && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN wget -qO /usr/local/bin/websocat https://github.com/vi/websocat/releases/latest/download/websocat.x86_64-unknown-linux-musl
RUN chmod a+x /usr/local/bin/websocat
#websocat --version

# We a reusing 4.4. at the moment because of issues on MacOS Docker 
#RUN curl -fsSL https://pgp.mongodb.com/server-6.0.asc | gpg -o /usr/share/keyrings/mongodb-server-6.0.gpg --dearmor
#RUN echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-6.0.gpg ] https://repo.mongodb.org/apt/ubuntu bionic/mongodb-org/6.0 multiverse" | tee /#etc/apt/sources.list.d/mongodb-org-6.0.list
#RUN apt-get update && \
#    apt-get install -y mongodb-mongosh mongodb-org-tools

# Install Nodemon, ESLint, Prettier, and Jest
RUN yarn global add nodemon eslint prettier jest

WORKDIR /app

RUN npm update -g
RUN npm install -g typescript
RUN npm install -g quicktype
RUN npm install pm2 -g
# Install node-gyp for better-sqlite3 (which will be replaced by Redis/MongoDB)
RUN npm install -g node-gyp


# Instead of the hacks below I deleted node_modules/@tensorflow and rann npm install again
# RUN cd /app/processor/nodejs/node_modules/@tensorflow/tfjs-node/deps/lib && \
#     ln -s libtensorflow.so.2.9.1 libtensorflow.so.2 && \
#     ln -s libtensorflow_framework.so.2.9.1 libtensorflow_framework.so.2
# RUN npm rebuild @tensorflow/tfjs-node --build-addon-from-source

EXPOSE 3000
EXPOSE 5000
EXPOSE 5001
EXPOSE 5002

COPY entrypoint.sh /entrypoint.sh
RUN chmod 755 /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
