# Dockerfile for Nginx Gateway Proxy
FROM nginx:alpine

COPY gateway/nginx.conf /etc/nginx/nginx.conf

# Install wget for healthcheck
RUN apk add --no-cache wget

EXPOSE 80

HEALTHCHECK --interval=15s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:80/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
