# syntax=docker/dockerfile:1

# Comments are provided throughout this file to help you get started.
# If you need more help, visit the Dockerfile reference guide at
# https://docs.docker.com/go/dockerfile-reference/

# Want to help us make this template better? Share your feedback here: https://forms.gle/ybq9Krt8jtBL3iCk7

ARG NODE_VERSION=20.16.0

################################################################################
# Use node image for base image for all stages.
FROM node:${NODE_VERSION}-alpine as base

# Set working directory for all build stages.
WORKDIR /usr/src/app


################################################################################
# Create a stage for installing production dependecies.
FROM base as deps

# Work inside image-handler so npm commands resolve its package.json
WORKDIR /usr/src/app/image-handler

# Download dependencies as a separate step to take advantage of Docker's caching.
# Leverage a cache mount to /root/.npm to speed up subsequent builds.
# Leverage bind mounts to package.json and package-lock.json to avoid having to copy them
# into this layer.
RUN --mount=type=bind,source=image-handler/package.json,target=package.json \
    --mount=type=bind,source=image-handler/package-lock.json,target=package-lock.json \
    --mount=type=cache,target=/root/.npm \
    npm ci

################################################################################
# Create a stage for building the application.
FROM deps as build

# Ensure we are still in the image-handler working directory
WORKDIR /usr/src/app/image-handler

# Download additional development dependencies before building, as some projects require
# "devDependencies" to be installed to build. If you don't need this, remove this step.
RUN --mount=type=bind,source=image-handler/package.json,target=package.json \
    --mount=type=bind,source=image-handler/package-lock.json,target=package-lock.json \
    --mount=type=cache,target=/root/.npm \
    npm ci

# Copy the image-handler source into the working directory
COPY image-handler/. .
# Copy shared solution-utils so relative imports (../solution-utils) resolve at build time
COPY solution-utils /usr/src/app/solution-utils
# Run the build script.
RUN npm run build

################################################################################
# Create a new stage to run the application with minimal runtime dependencies
# where the necessary files are copied from the build stage.
FROM base as final

ENV NODE_ENV production

# Set runtime working directory to image-handler and ensure correct ownership
WORKDIR /usr/src/app/image-handler
RUN mkdir -p /usr/src/app/image-handler && chown -R node:node /usr/src/app/image-handler

# Copy image-handler package.json so that package manager commands can be used.
COPY image-handler/package.json .

# Copy the production dependencies from the deps stage and also
# the built application from the build stage into the image.
COPY --from=deps --chown=node:node /usr/src/app/image-handler/node_modules ./node_modules
COPY --from=build --chown=node:node /usr/src/app/image-handler/dist ./dist


# Expose the port that the application listens on.
EXPOSE 47890

# Drop privileges to non-root user for running the app
USER node

# Run the application.
CMD ["node", "dist/image-handler/server.js"]
