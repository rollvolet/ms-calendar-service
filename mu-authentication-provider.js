import { query, sparqlEscapeUri } from 'mu';

const SESSIONS_GRAPH = process.env.SESSIONS_GRAPH || 'http://mu.semte.ch/graphs/sessions';

export default class MuAuthenticationProvider {
  constructor(sessionUri) {
    this.sessionUri = sessionUri;
  }

	/**
	 * This method will get called before every request to the msgraph server
	 * This should return a Promise that resolves to an accessToken (in case of success)
   * or rejects with error (in case of failure)
	 */
  async getAccessToken(options) {
    const queryResult = await query(`
      PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
      PREFIX oauth: <http://data.rollvolet.be/vocabularies/oauth-2.0/>
      SELECT ?accessToken
      WHERE {
        GRAPH <${SESSIONS_GRAPH}> {
          ?oauthSession oauth:authenticates ${sparqlEscapeUri(this.sessionUri)} ;
                        oauth:tokenValue ?accessToken .
        }
      }`);

    if (queryResult.results.bindings.length) {
      return queryResult.results.bindings[0]['accessToken'].value;
    } else {
      throw new Error('No access token available for session');
    }
  };
}
