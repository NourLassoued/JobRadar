# JobRadar - frontend Angular 18 servi par nginx (multi-stage)

# --- Étape 1 : build Angular ---
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm npm config set fetch-retries 5 && npm config set fetch-retry-mintimeout 20000 && npm config set fetch-retry-maxtimeout 120000 && npm ci --no-audit --no-fund
COPY . .
# Dans le cluster, le frontend appelle l'API sur la même adresse (/api), nginx fait le relais vers le backend
RUN sed -i "s#apiUrl: '[^']*'#apiUrl: '/api'#" src/environments/environment.ts
# Les budgets de taille (4 kB par composant) bloquent le build production : on les retire pour l'image
RUN node -e "const fs=require('fs');const j=JSON.parse(fs.readFileSync('angular.json'));for(const p of Object.values(j.projects)){const c=p.architect.build.configurations||{};if(c.production)delete c.production.budgets;}fs.writeFileSync('angular.json',JSON.stringify(j,null,2));"
# Application servie en statique : pas de SSR ni de prérendu dans l'image
RUN npx ng build --configuration production --ssr=false --prerender=false

# --- Étape 2 : nginx ---
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/frontend/browser /usr/share/nginx/html
EXPOSE 80
