import { app, errorHandler } from 'mu';
import { getSessionIdHeader, error } from './utils';
import { insertCalendarEvent, updateCalendarEvent, getCalendarEvent, deleteCalendarEvent, getUser } from './sparql';
import GraphApiClient from './graph-api';
import CalendarManager from './calendar-manager';

const calendarManager = new CalendarManager();

function setLocationString(attrs) {
  attrs.location = [attrs.street,
                    `${attrs['postal-code'] || ''} ${attrs.city || ''}`]
    .filter((line) => line && line.trim().length)
    .join(', ');
}

app.post('/calendar-events/', async function(req, res, next) {
  const sessionUri = getSessionIdHeader(req);
  if (!sessionUri)
    return next(new Error('Session header is missing'));

  try {
    const graphApi = new GraphApiClient(sessionUri);
    const payload = req.body.data.attributes;
    const { request, intervention, order } = req.body.data.relationships;
    const linkedResourceId = [request, intervention, order].find((r) => r).data.id;
    setLocationString(payload);
    const { resource, calendar } = await calendarManager.determineCalendar(linkedResourceId);
    const msCalendarId = calendarManager.getMsCalendarId(calendar.uri);
    const msEvent = await graphApi.createCalendarEvent(msCalendarId, payload, resource);
    payload['ms-identifier'] = msEvent.id;
    const user = await getUser(sessionUri);
    const attributes = await insertCalendarEvent(calendar.uri, payload, resource.uri, user);
    const eventId = attributes.id;
    delete attributes.id;
    return res.status(201).send({
      data: {
        id: eventId,
        type: 'calendar-events',
        attributes
      }
    });
  } catch(e) {
    console.trace(e);
    return next(new Error(e.message));
  }
});

app.get('/calendar-events/:id/ms-event', async function(req, res, next) {
  const sessionUri = getSessionIdHeader(req);
  if (!sessionUri)
    return next(new Error('Session header is missing'));

  try {
    const eventId = req.params.id;
    const event = await getCalendarEvent(eventId);

    if (event && event['calendar'] && event['ms-identifier']) {
      const graphApi = new GraphApiClient(sessionUri);
      const msCalendarId = calendarManager.getMsCalendarId(event['calendar']);
      const msEvent = await graphApi.getCalendarEvent(msCalendarId, event);
      if (msEvent) {
        if (event.date != msEvent.date) { // both in format YYYY-MM-DD
          return res.status(409).send({
            data: {
              id: event['ms-identifier'],
              type: 'ms-events',
              attributes: {
                date: msEvent.date
              }
            }
          });
        } else {
          return res.status(200).send({
            data: {
              id: event['ms-identifier'],
              type: 'ms-events'
            }
          });
        }
      } else {
        return res.status(200).send({ data: null });
      }
    } else {
      if (!event) {
        console.log(`No calendar-event found with id ${eventId} in triplestore`);
        return res.status(404).send();
      } else if (!event['calendar']) {
        console.log(`Event with id ${eventId} is not linked to an agenda in the triplestore.`);
        return res.status(424).send();
      } else {
        console.log(`Event with id ${eventId}, but without MS-event found in triplestore. Probably an Access-mastered event.`);
        return res.status(200).send({ data: null });
      }
    }
  } catch(e) {
    console.trace(e);
    return next(new Error(e.message));
  }
});

app.patch('/calendar-events/:id', async function(req, res, next) {
  const sessionUri = getSessionIdHeader(req);
  if (!sessionUri)
    return next(new Error('Session header is missing'));

  try {
    const eventId = req.params.id;
    const event = await getCalendarEvent(eventId);

    if (event && event['ms-identifier']) {
      const graphApi = new GraphApiClient(sessionUri);
      const payload = req.body.data.attributes;
      payload.id = eventId;
      payload.uri = event.uri;
      setLocationString(payload);
      const msCalendarId = calendarManager.getMsCalendarId(event['calendar']);
      const requiresReschedule = payload.date != event.date;
      const msEvent = await graphApi.updateCalendarEvent(msCalendarId, payload, event.resource, requiresReschedule);
      // ms-identifier might have changed if a new event is created via the Graph API
      // e.g. if the previous event has been manually deleted in the agenda
      payload['ms-identifier'] = msEvent.id;
      const user = await getUser(sessionUri);
      const attributes = await updateCalendarEvent(event.calendar, payload, event.resource.uri, user);
      delete attributes.id;
      return res.status(200).send({
        data: {
          id: eventId,
          type: 'calendar-events',
          attributes
        }
      });
    } else {
      if (!event) {
        console.log(`No calendar-event found with id ${eventId} in triplestore`);
        return res.status(404).send();
      } else { // event without ms-identifier found in triplestore
        console.log(`Cannot update Access-mastered event.`);
        return res.status(409).send();
      }
    }
  } catch(e) {
    console.trace(e);
    return next(new Error(e.message));
  }
});

app.delete('/calendar-events/:id', async function(req, res, next) {
  const sessionUri = getSessionIdHeader(req);
  if (!sessionUri)
    return next(new Error('Session header is missing'));

  try {
    const eventId = req.params.id;
    const event = await getCalendarEvent(eventId);
    if (event) {
      // delete in triplestore first such that delta's can already
      // be processed by other service (e.g. mu-cl-resources)
      await deleteCalendarEvent(event.uri);
      if (event['calendar'] && event['ms-identifier']) {
        const graphApi = new GraphApiClient(sessionUri);
        const msCalendarId = calendarManager.getMsCalendarId(event.calendar);
        await graphApi.deleteCalendarEvent(msCalendarId, event['ms-identifier']);
      }
    }
    return res.status(204).send();
  } catch(e) {
    console.trace(e);
    return next(new Error(e.message));
  }
});

app.use(errorHandler);
