FROM nginx:alpine

RUN apk add --no-cache certbot certbot-nginx bash

# Auto-renew Let's Encrypt certs daily at 3am
RUN echo "0 3 * * * certbot renew --quiet --deploy-hook 'nginx -s reload'" | crontab -

COPY templates/ /etc/nginx/templates/
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
