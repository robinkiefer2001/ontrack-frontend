FROM node:20-alpine

WORKDIR /app

# Kopiere package.json und package-lock.json
COPY package.json ./
RUN npm install
COPY . .
RUN npm run build

CMD ["npm", "run", "dev", "--", "--port", "3000", "--host"]