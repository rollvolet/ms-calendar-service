/**
 * Get the session ID from the request headers
 *
 * @return {string} The session ID from the request headers
*/
const getSessionIdHeader = function(request) {
  return request.get('mu-session-id');
};

/**
 * Helper function to return an error response
*/
const error = function(res, message, status = 400) {
  return res.status(status).json({errors: [ { title: message } ] });
};

const sleep = function(millis) {
  return new Promise(resolve => setTimeout(resolve, millis));
};

export {
  getSessionIdHeader,
  error,
  sleep
}
