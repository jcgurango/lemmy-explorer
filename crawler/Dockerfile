FROM node:14-alpine

RUN mkdir -p /usr/src/app/
WORKDIR /usr/src/app/
COPY . ./
RUN npm install
ENV REDIS_URL=redis://redis:6379

ENTRYPOINT npm run start:docker
