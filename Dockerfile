# Dockerfile para Control de Vencimientos (frontend estático)
FROM nginx:alpine

# Elimina archivos por defecto de nginx
RUN rm -rf /usr/share/nginx/html/*

# Copia todo el contenido del repo al directorio público de nginx
COPY . /usr/share/nginx/html

# Expone el puerto 80 (Render lo mapea automáticamente)
EXPOSE 80

# Comando por defecto (nginx en modo foreground)
CMD ["nginx", "-g", "daemon off;"]
