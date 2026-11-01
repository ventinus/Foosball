const { Amplify } = require("aws-amplify");
const { server } = require("./mocks/server.js");

// Tests never hit AWS: point Amplify at a fake AppSync endpoint that MSW intercepts,
// so the real (gitignored) aws-exports.js isn't needed.
Amplify.configure({
  API: {
    GraphQL: {
      endpoint: "https://test.appsync-api.us-west-2.amazonaws.com/graphql",
      region: "us-west-2",
      defaultAuthMode: "apiKey",
      apiKey: "da2-test",
    },
  },
});

// Establish API mocking before all tests.
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));

// Reset any request handlers that we may add during the tests,
// so they don't affect other tests.
afterEach(() => server.resetHandlers());

// Clean up after the tests are finished.
afterAll(() => server.close());
