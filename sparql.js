import { query, update, uuid,
         sparqlEscapeUri, sparqlEscapeString, sparqlEscapeDate, sparqlEscapeDateTime } from 'mu';

const BASE_URI = 'http://data.rollvolet.be';

async function insertCalendarEvent(calendarUri, payload, user) {
  const eventId = uuid();
  const eventUri = `${BASE_URI}/calendar-events/${eventId}`;
  const now = new Date();
  const event = Object.assign({}, payload, {
    id: eventId,
    uri: eventUri,
    creator: user,
    editor: user,
    created: now,
    modified: now
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

async function updateCalendarEvent(calendarUri, event, user) {
  event.editor = user;
  event.modified = new Date();

  await update(`DELETE WHERE { ${sparqlEscapeUri(event.uri)} ?p ?o . }`);
  await _insertCalendarEvent(event);
  await update(`
    PREFIX ncal: <http://www.semanticdesktop.org/ontologies/2007/04/02/ncal#>
    INSERT DATA {
      ${sparqlEscapeUri(calendarUri)} ncal:component ${sparqlEscapeUri(event.uri)} .
    }
  `);

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
  if (event.creator) {
    optionalProperties.push(` dct:creator ${sparqlEscapeUri(event.creator)} ;`);
  }
  if (event.editor) {
    optionalProperties.push(` schema:editor ${sparqlEscapeUri(event.editor)} ;`);
  }

  // TODO Fix dct:subject triple once request/intervention/order are resources in triplestore
  const linkedResource = event.request || event.intervention || event.order;

  await update(`
    PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
    PREFIX ncal: <http://www.semanticdesktop.org/ontologies/2007/04/02/ncal#>
    PREFIX dct: <http://purl.org/dc/terms/>
    PREFIX schema: <http://schema.org/>

    INSERT DATA {
      ${sparqlEscapeUri(event.uri)} a ncal:Event ;
        mu:uuid ${sparqlEscapeString(event.id)} ;
        ncal:uid ${sparqlEscapeString(event['ms-identifier'])} ;
        ncal:date ${sparqlEscapeDate(event.date)} ;
        ncal:summary ${sparqlEscapeString(event.subject)} ;
        ncal:url ${sparqlEscapeUri(event.url)} ;
        ${optionalProperties.join('\n')}
        dct:source 'RKB' ;
        dct:subject ${sparqlEscapeUri(linkedResource)} ;
        dct:created ${sparqlEscapeDateTime(event.created)} ;
        dct:modified ${sparqlEscapeDateTime(event.modified)} .
    }
  `);
}

async function getCalendarEvent(eventId) {
  const result = await query(`
    PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
    PREFIX ncal: <http://www.semanticdesktop.org/ontologies/2007/04/02/ncal#>
    PREFIX dct: <http://purl.org/dc/terms/>
    PREFIX schema: <http://schema.org/>

    SELECT ?event ?date ?created ?modified ?identifier ?creator ?editor ?calendar
    WHERE {
      ?event a ncal:Event ;
        mu:uuid ${sparqlEscapeString(eventId)} ;
        ncal:date ?date ;
        dct:created ?created ;
        dct:modified ?modified .
      OPTIONAL { ?event ncal:uid ?identifier . }
      OPTIONAL { ?event dct:creator ?creator . }
      OPTIONAL { ?event schema:editor ?editor . }
      ?calendar ncal:component ?event .
    } LIMIT 1
  `);

  if (result.results.bindings.length) {
    const b = result.results.bindings[0];
    const event = {
      id: eventId,
      uri: b['event'].value,
      date: b['date'].value,
      calendar: b['calendar'].value,
      created: b['created'].value,
      modified: b['modified'].value,
      'ms-identifier': b['identifier']?.value,
      creator: b['creator']?.value,
      editor: b['editor']?.value,
    };
    return event;
  } else {
    return null;
  }
}

async function deleteCalendarEvent(eventUri) {
  // ms-identifier is optional, because not available for Access-mastered events.
  // Therefore we delete this property first in a separate query.
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

async function getUser(sessionUri) {
  const result = await query(`
    PREFIX session: <http://mu.semte.ch/vocabularies/session/>
    PREFIX foaf: <http://xmlns.com/foaf/0.1/>

    SELECT ?user
    WHERE {
      ${sparqlEscapeUri(sessionUri)} session:account ?account .
      ?user foaf:account ?account .
    } LIMIT 1
  `);

  if (result.results.bindings.length) {
    return result.results.bindings[0]['user'].value;
  } else {
    return null;
  }
}

export {
  insertCalendarEvent,
  updateCalendarEvent,
  getCalendarEvent,
  deleteCalendarEvent,
  getUser
}
