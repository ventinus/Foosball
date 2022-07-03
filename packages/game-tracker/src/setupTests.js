const { Amplify } = require("aws-amplify");
const { server } = require("./mocks/server.js");

const awsconfig = require("./aws-exports");

// Establish API mocking before all tests.
beforeAll(() => {
  Amplify.configure(awsconfig);
  server.listen();
});

// Reset any request handlers that we may add during the tests,
// so they don't affect other tests.
afterEach(() => server.resetHandlers());

// Clean up after the tests are finished.
afterAll(() => server.close());
