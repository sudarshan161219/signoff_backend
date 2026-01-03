FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY prisma ./prisma
COPY prisma.config.ts ./

RUN npx prisma generate

COPY . .
RUN npm run build

EXPOSE 8080
CMD ["sh", "-c", "npx prisma migrate deploy && npm start"]
