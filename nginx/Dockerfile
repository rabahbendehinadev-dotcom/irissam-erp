FROM nginx:1.27-alpine

LABEL org.opencontainers.image.title="IRISSAM — Nginx Reverse Proxy"

RUN rm /etc/nginx/nginx.conf
COPY nginx/nginx.conf /etc/nginx/nginx.conf

EXPOSE 80 443
CMD ["nginx", "-g", "daemon off;"]
