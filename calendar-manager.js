import { sparqlEscapeString } from 'mu';
import { querySudo } from '@lblod/mu-auth-sudo';

function isTruthy(value) {
  return [true, 'true', 1, '1', 'yes', 'Y', 'on'].includes(value);
}

const USE_PERSONAL_CALENDAR = isTruthy(process.env.USE_PERSONAL_CALENDAR || 'no');
const CUSTOMER_VISIT_CALENDAR = process.env.CUSTOMER_VISIT_CALENDAR || 'http://data.rollvolet.be/calendars/88e92b1b-c3e2-4a2e-a7a4-d34aee6c7746';
const PLANNING_CALENDAR = process.env.PLANNING_CALENDAR || 'http://data.rollvolet.be/calendars/0147d534-d7c2-49dc-bd8f-bb6951664017';

export default class CalendarManager {
  calendars = {}; // mapping of Calendar URIs to MS calendar IDs

  constructor() {
    this.fetchCalendars();
  }

  // Called during initialization, hence using sudo-queries
  async fetchCalendars() {
    const result = await querySudo(`
    PREFIX ncal: <http://www.semanticdesktop.org/ontologies/2007/04/02/ncal#>
    PREFIX nie: <http://www.semanticdesktop.org/ontologies/2007/01/19/nie#>
    SELECT DISTINCT ?calendar ?msIdentifier
    WHERE {
      ?calendar a ncal:Calendar ; nie:identifier ?msIdentifier .
    }
  `);

    for (let b of result.results.bindings) {
      const uri = b['calendar'].value;
      this.calendars[uri] = USE_PERSONAL_CALENDAR ? null : b['msIdentifier'].value;
    }
  }

  async determineCalendar(resourceId) {
    const result = await querySudo(`
    PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
    SELECT DISTINCT ?resource ?type
    WHERE {
      ?resource a ?type ; mu:uuid ${sparqlEscapeString(resourceId)} .
    } LIMIT 1
  `);

    if (result.results.bindings.length) {
      const type = result.results.bindings[0]['type'].value;
      const resource = result.results.bindings[0]['resource'].value;
      if (type == 'http://data.rollvolet.be/vocabularies/crm/Request') {
        return {
          resource: {
            uri: resource,
            type
          },
          calendar: {
            uri: CUSTOMER_VISIT_CALENDAR
          }
        };
      } else {
        return {
          resource: {
            uri: resource,
            type
          },
          calendar: {
            uri: PLANNING_CALENDAR
          }
        };
      }
    } else {
      return null;
    }
  }

  getMsCalendarId(uri) {
    return this.calendars[uri];
  }
}
