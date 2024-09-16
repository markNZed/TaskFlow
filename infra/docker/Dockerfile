FROM node:18-buster-slim

# Set bash as the default shell
SHELL ["/bin/bash", "-c"]
ENV SHELL=/bin/bash
RUN chsh -s /bin/bash

RUN apt-get update && \
    apt-get upgrade -y && \
    apt-get install -y bash git build-essential screen procps vim wget net-tools curl iputils-ping redis-tools && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /root

RUN wget https://repo.anaconda.com/archive/Anaconda3-2023.09-0-Linux-x86_64.sh && \
    bash ./Anaconda3-2023.09-0-Linux-x86_64.sh -b -p /opt/anaconda3 && \
    eval "$(/opt/anaconda3/bin/conda shell.bash hook)" && \
    conda init && \
    pip install sumy rx redis aioredis && \
    python -c "import nltk; nltk.download('punkt')"

RUN wget -qO /usr/local/bin/websocat https://github.com/vi/websocat/releases/latest/download/websocat.x86_64-unknown-linux-musl
RUN chmod a+x /usr/local/bin/websocat
#websocat --version

# We a reusing 4.4. at the moment because of issues on MacOS Docker 
#RUN curl -fsSL https://pgp.mongodb.com/server-6.0.asc | gpg -o /usr/share/keyrings/mongodb-server-6.0.gpg --dearmor
#RUN echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-6.0.gpg ] https://repo.mongodb.org/apt/ubuntu bionic/mongodb-org/6.0 multiverse" | tee /#etc/apt/sources.list.d/mongodb-org-6.0.list
#RUN apt-get update && \
#    apt-get install -y mongodb-mongosh mongodb-org-tools

RUN apt-get update && \
    wget -qO - https://www.mongodb.org/static/pgp/server-4.4.asc | apt-key add - && \
    apt-get install -y software-properties-common && \
    add-apt-repository 'deb https://repo.mongodb.org/apt/debian buster/mongodb-org/4.4 main' && \
    apt-get update && \
    apt-get install -y mongodb-mongosh

# Install Nodemon, ESLint, Prettier, and Jest
RUN yarn global add nodemon eslint prettier jest

RUN apt install unzip && \
    apt install -y openssl libssl-dev && \
    wget https://github.com/AGWA/git-crypt/archive/refs/heads/master.zip && \
    unzip master.zip && \
    cd git-crypt-master && \
    make && \
    make install

WORKDIR /app

RUN npm update -g
RUN npm install -g quicktype
#RUN npm install pm2 -g

# The jq command-line utility is a lightweight and flexible command-line JSON processor. It's widely used for parsing, filtering, and transforming JSON data.
RUN apt-get install -y jq 

# To provide support for encoding like d’assurance
RUN apt-get install -y locales
# To get unicode chars working in screen I needed to set "defutf8 on" in ~/.screenrc 
# Also added "export LANG=en_US.UTF-8" to ~/.bashrc

# For crawling
RUN apt-get install -y lynx

RUN npm install forever -g
# So we can see react-app-rewired from forever
RUN npm install -g react-app-rewired

# Instead of the hacks below I deleted node_modules/@tensorflow and ran npm install again
# RUN cd /app/nodes/rxjs/node_modules/@tensorflow/tfjs-node/deps/lib && \
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
