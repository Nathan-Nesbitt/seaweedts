FROM node:18
# Create the working directory
WORKDIR /seaweed
# Copy the requirements file
COPY package*.json ./
# Install all of the dependencies
RUN npm install
# Add all the files to the image
ADD . .