FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 4000

CMD ["sh", "-c", "npm run prisma:generate && npm run db:push && npm run seed && npm run dev"]
