# Stage 1: Build the React app
FROM node:18-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Serve the static files with Nginx
FROM nginx:1.21-alpine
COPY --from=build /app/dist /usr/share/nginx/html
# Nginx will serve index.html by default
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]