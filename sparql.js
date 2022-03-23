import { query, update, uuid,
         sparqlEscapeUri, sparqlEscapeString, sparqlEscapeDate } from 'mu';

const BASE_URI = 'http://data.rollvolet.be';

async function insertCalendarEvent(calendarUri, event, msEvent) {
  const eventId = uuid();
  const eventUri = `${BASE_URI}/calendar-events/${eventId}`;
  // TODO Fix dct:subject triple once request/intervention/order are resources in triplestore

  const optionalProperties = [];
  if (event.description) {
    optionalProperties.push(` ncal:description ${sparqlEscapeString(event.description)} ;`);
  }
  if (event.location) {
    optionalProperties.push(` ncal:location ${sparqlEscapeString(event.location)} ;`);
  }

  await update(`
    PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
    PREFIX ncal: <http://www.semanticdesktop.org/ontologies/2007/04/02/ncal#>
    PREFIX dct: <http://purl.org/dc/terms/>

    INSERT DATA {
      ${sparqlEscapeUri(calendarUri)} ncal:component ${sparqlEscapeUri(eventUri)} .
      ${sparqlEscapeUri(eventUri)} a ncal:Event ;
        mu:uuid ${sparqlEscapeString(eventId)} ;
        ncal:uid ${sparqlEscapeString(msEvent.id)} ;
        ncal:date ${sparqlEscapeDate(event.date)} ;
        ncal:summary ${sparqlEscapeString(event.subject)} ;
        ncal:url ${sparqlEscapeUri(event.url)} ;
        ${optionalProperties.join('\n')}
        dct:source 'RKB' ;
        dct:subject ${sparqlEscapeUri(event.request)} .
    }
  `);

  return Object.assign({}, event, {
    id: eventId,
    uri: eventUri,
    'ms-identifier': msEvent.id
  });
}

async function getCalendarEvent(eventId) {
  const result = await query(`
    PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
    PREFIX ncal: <http://www.semanticdesktop.org/ontologies/2007/04/02/ncal#>
    PREFIX dct: <http://purl.org/dc/terms/>

    SELECT ?event ?identifier ?calendar
    WHERE {
      ?event a ncal:Event ;
        mu:uuid ${sparqlEscapeString(eventId)} ;
        ncal:uid ?identifier .
      ?calendar ncal:component ?event .
    } LIMIT 1
  `);

  if (result.results.length) {
    const b = result.results[0];
    return {
      id: eventId,
      uri: b['event'].value,
      msId: b['identifier'].value,
      calendar: b['calendar'].value
    };
  } else {
    return null;
  }
}

async function deleteCalendarEvent(eventId) {
  await update(`
    PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
    PREFIX ncal: <http://www.semanticdesktop.org/ontologies/2007/04/02/ncal#>
    PREFIX dct: <http://purl.org/dc/terms/>

    DELETE {
      ?event ?p ?o .
      ?calendar ncal:component ?event .
    } WHERE {
      ?event a ncal:Event ;
        mu:uuid ${sparqlEscapeString(eventId)} ;
        ?p ?o .
      ?calendar ncal:component ?event .
    }
  `);
}

export {
  insertCalendarEvent,
  getCalendarEvent,
  deleteCalendarEvent
}
