FROM node:20-alpine

WORKDIR /app

# Install dependencies first for better layer caching
COPY package*.json ./
RUN npm install

# Copy application source code
COPY . .

EXPOSE 5173

# Run Vite dev server with host 0.0.0.0
CMD ["npm", "run", "dev"]
