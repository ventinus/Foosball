// Amplify rejects every failed request with `{ data, errors }`. Errors that
// AppSync itself returned carry an `errorType`; network failures, timeouts and
// HTTP errors (e.g. an expired API key) don't, so those are worth retrying.
const errorTypes = (err) =>
  Array.isArray(err?.errors) ? err.errors.map((e) => e?.errorType) : [];

// A create for a record that already exists (e.g. the response to an earlier
// attempt was lost), or an update for one that doesn't.
exports.isConditionFailure = (err) =>
  errorTypes(err).some((type) => type?.includes("ConditionalCheckFailed"));

// AppSync received the request and refused it; retrying may not help.
exports.isRejected = (err) => {
  const types = errorTypes(err);
  return types.length > 0 && types.every(Boolean);
};
