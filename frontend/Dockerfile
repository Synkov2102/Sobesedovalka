FROM node:20-alpine AS deps
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

FROM node:20-alpine AS build
WORKDIR /app/frontend

# Vite вшивает VITE_* в бандл при сборке (в runtime nginx их не задать).
ARG VITE_VK_APP_ID=
ARG VITE_VK_REDIRECT_URI=
ARG VITE_YANDEX_CLIENT_ID=
ARG VITE_YANDEX_REDIRECT_URI=
ARG VITE_COLLAB_WS_URL=

ENV VITE_VK_APP_ID=$VITE_VK_APP_ID
ENV VITE_VK_REDIRECT_URI=$VITE_VK_REDIRECT_URI
ENV VITE_YANDEX_CLIENT_ID=$VITE_YANDEX_CLIENT_ID
ENV VITE_YANDEX_REDIRECT_URI=$VITE_YANDEX_REDIRECT_URI
ENV VITE_COLLAB_WS_URL=$VITE_COLLAB_WS_URL

COPY --from=deps /app/frontend/node_modules ./node_modules
COPY frontend/ ./
RUN npm run build

FROM nginx:alpine AS runner
COPY --from=build /app/frontend/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
