FROM node:16-alpine3.16

# Create App directory in Container
WORKDIR /usr/src/app

# Update
RUN apk update

# Install App dependencies
COPY package*.json ./
RUN npm install

# Copy bundle App source
COPY . .

# Run App
CMD ["npm", "start"]