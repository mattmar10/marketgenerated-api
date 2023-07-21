# Use the official Node.js image as the base image
FROM node:lts-alpine

# Set the working directory inside the container
WORKDIR /usr/app

# Copy package.json and package-lock.json to the container
COPY package*.json ./

# Install dependencies (including devDependencies for the build step)
RUN npm install --production

# Copy the rest of the source code to the container
COPY . .

# Expose the port your API is running on (assuming it's port 8778)
EXPOSE 8777

# Build your TypeScript app inside the container
RUN npm run build

# Define the command to start your app when the container starts
CMD ["node", "build/app.js"]
