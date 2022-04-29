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

  determineCalendar(event) {
    // TODO Convert to a SPARQL query to determine rdf:Class of the related resource once
    // request/intervention/order are available as resources in triplestore.
    // Currently request, intervention and order attribute all contain the same URI value.
    // We're going to make a distinction based on the base URI.
    const subject = event.request || event.intervention || event.order;
    if (subject.startsWith('http://data.rollvolet.be/requests/')) {
      return CUSTOMER_VISIT_CALENDAR;
    } else {
      return PLANNING_CALENDAR;
    }
  }

  getMsCalendarId(uri) {
    return this.calendars[uri];
  }
}
