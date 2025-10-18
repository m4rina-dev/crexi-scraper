# Use the official Apify Node.js image with Puppeteer and Chrome pre-installed
FROM apify/actor-node-puppeteer-chrome:20

# Copy all files from the project to the container
COPY . ./

# Install dependencies
RUN npm install --include=dev

# Build TypeScript
RUN npm run build

# By default, run the start command
CMD npm start
