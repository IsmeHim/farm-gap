FROM node:20-alpine

WORKDIR /app

# Install dependencies first for better layer caching
COPY package*.json ./
RUN npm install

# Copy application source code
COPY . .

EXPOSE 4000

# Run with nodemon for live reload
CMD ["npm", "run", "dev"]
