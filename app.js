import { app, errorHandler } from 'mu';
import { getSessionIdHeader, error } from './utils';
import { insertCalendarEvent, updateCalendarEvent, getCalendarEvent, deleteCalendarEvent } from './sparql';
import GraphApiClient from './graph-api';
import CalendarManager from './calendar-manager';

const calendarManager = new CalendarManager();

app.post('/calendar-events/', async function(req, res, next) {
  const sessionUri = getSessionIdHeader(req);
  if (!sessionUri)
    return next(new Error('Session header is missing'));

  try {
    const graphApi = new GraphApiClient(sessionUri);
    const payload = req.body.data.attributes;
    const calendarUri = await calendarManager.determineCalendar(payload);
    const msCalendarId = calendarManager.getMsCalendarId(calendarUri);
    const msEvent = await graphApi.createCalendarEvent(msCalendarId, payload);
    const attributes = await insertCalendarEvent(calendarUri, payload, msEvent.id);
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

app.patch('/calendar-events/:id', async function(req, res, next) {
  const sessionUri = getSessionIdHeader(req);
  if (!sessionUri)
    return next(new Error('Session header is missing'));

  try {
    const eventId = req.params.id;
    const event = await getCalendarEvent(eventId);

    if (event) {
      const graphApi = new GraphApiClient(sessionUri);
      const payload = req.body.data.attributes;
      payload.id = eventId;
      payload.uri = event.uri;
      const msCalendarId = calendarManager.getMsCalendarId(event.calendar);
      const msEvent = await graphApi.updateCalendarEvent(msCalendarId, payload);
      const attributes = await updateCalendarEvent(payload);
      delete attributes.id;
      return res.status(200).send({
        data: {
          id: eventId,
          type: 'calendar-events',
          attributes
        }
      });
    } else {
      console.log(`No calendar-event found with id ${eventId} in triplestore`);
      return res.status(404).send();
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
      const graphApi = new GraphApiClient(sessionUri);
      const msCalendarId = calendarManager.getMsCalendarId(event.calendar);
      await graphApi.deleteCalendarEvent(msCalendarId, event['ms-identifier']);
    }
    return res.status(204).send();
  } catch(e) {
    console.trace(e);
    return next(new Error(e.message));
  }
});

app.use(errorHandler);
