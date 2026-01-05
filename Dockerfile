FROM node:20-alpine

# 1. Install OpenSSL
RUN apk add --no-cache openssl

WORKDIR /app

# 2. Install dependencies
COPY package*.json ./
RUN npm ci

# 3. Setup Prisma
COPY prisma ./prisma
# (Optional) COPY prisma.config.ts ./ 

# Generate client (using dummy URL)
RUN DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" npx prisma generate

# 4. COPY SOURCE CODE (This must happen BEFORE build!)
COPY . .

# 5. Build the app
# We pass the dummy URL again because the build script runs 'prisma generate'
RUN DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" npm run build

EXPOSE 8080
USER node
CMD ["npm", "start"]