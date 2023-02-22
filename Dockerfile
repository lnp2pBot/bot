FROM node:16-buster-slim

# Create App directory in Container
WORKDIR /usr/src/app

# Update
RUN apt update
RUN apt upgrade -y

# Install App dependencies
COPY package*.json ./
RUN npm install

# Copy bundle App source
COPY . .

# Run App
CMD ["npm", "start"]
