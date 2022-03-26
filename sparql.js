import { query, update, uuid,
         sparqlEscapeUri, sparqlEscapeString, sparqlEscapeDate } from 'mu';

const BASE_URI = 'http://data.rollvolet.be';

async function insertCalendarEvent(calendarUri, payload) {
  const eventId = uuid();
  const eventUri = `${BASE_URI}/calendar-events/${eventId}`;
  const event = Object.assign({}, payload, {
    id: eventId,
    uri: eventUri
  });
  await _insertCalendarEvent(event);
  await update(`
    PREFIX ncal: <http://www.semanticdesktop.org/ontologies/2007/04/02/ncal#>
    INSERT DATA {
      ${sparqlEscapeUri(calendarUri)} ncal:component ${sparqlEscapeUri(eventUri)} .
    }
  `);

  return event;
}

async function updateCalendarEvent(event) {
  await update(`DELETE WHERE { ${sparqlEscapeUri(event.uri)} ?p ?o . }`);
  await _insertCalendarEvent(event);
  return event;
}

async function _insertCalendarEvent(event) {
  const optionalProperties = [];
  if (event.description) {
    optionalProperties.push(` ncal:description ${sparqlEscapeString(event.description)} ;`);
  }
  if (event.location) {
    optionalProperties.push(` ncal:location ${sparqlEscapeString(event.location)} ;`);
  }

  // TODO Fix dct:subject triple once request/intervention/order are resources in triplestore
  await update(`
    PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
    PREFIX ncal: <http://www.semanticdesktop.org/ontologies/2007/04/02/ncal#>
    PREFIX dct: <http://purl.org/dc/terms/>

    INSERT DATA {
      ${sparqlEscapeUri(event.uri)} a ncal:Event ;
        mu:uuid ${sparqlEscapeString(event.id)} ;
        ncal:uid ${sparqlEscapeString(event['ms-identifier'])} ;
        ncal:date ${sparqlEscapeDate(event.date)} ;
        ncal:summary ${sparqlEscapeString(event.subject)} ;
        ncal:url ${sparqlEscapeUri(event.url)} ;
        ${optionalProperties.join('\n')}
        dct:source 'RKB' ;
        dct:subject ${sparqlEscapeUri(event.request)} .
    }
  `);
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

  if (result.results.bindings.length) {
    const b = result.results.bindings[0];
    return {
      id: eventId,
      uri: b['event'].value,
      'ms-identifier': b['identifier'].value,
      calendar: b['calendar'].value
    };
  } else {
    return null;
  }
}

async function deleteCalendarEvent(eventUri) {
  // Force cache clearing in mu-cl-resources by deleting only one property
  // without removing the rdf:type or mu:uuid first.
  // That way mu-cl-resources generates correct clear keys for mu-cache.
  // TODO this query can be removed once the cache clearing issue is fixed in mu-cl-resources
  await update(`
    PREFIX ncal: <http://www.semanticdesktop.org/ontologies/2007/04/02/ncal#>

    DELETE {
      ${sparqlEscapeUri(eventUri)} ncal:uid ?identifier .
    } WHERE {
      ${sparqlEscapeUri(eventUri)} a ncal:Event ;
          ncal:uid ?identifier .
    }
  `);

  await update(`
    PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
    PREFIX ncal: <http://www.semanticdesktop.org/ontologies/2007/04/02/ncal#>
    PREFIX dct: <http://purl.org/dc/terms/>

    DELETE {
      ${sparqlEscapeUri(eventUri)} ?p ?o .
      ?calendar ncal:component ${sparqlEscapeUri(eventUri)} .
    } WHERE {
      ${sparqlEscapeUri(eventUri)} a ncal:Event ;
        ?p ?o .
      ?calendar ncal:component ${sparqlEscapeUri(eventUri)} .
    }
  `);
}

export {
  insertCalendarEvent,
  updateCalendarEvent,
  getCalendarEvent,
  deleteCalendarEvent
}
