import { app, errorHandler } from 'mu';
import { getSessionIdHeader, error } from './utils';
import { insertCalendarEvent, getCalendarEvent, deleteCalendarEvent } from './sparql';
import GraphApiClient from './graph-api';
import CalendarManager from './calendar-manager';

const calendarManager = new CalendarManager();

app.post('/calendar-events/', async function(req, res, next) {
  const sessionUri = getSessionIdHeader(req);
  if (!sessionUri)
    return next(new Error('Session header is missing'));

  try {
    const client = new GraphApiClient(sessionUri);
    const payload = req.body.data.attributes;
    const calendarUri = await calendarManager.determineCalendar(payload);
    const msCalendarId = calendarManager.getMsCalendarId(calendarUri);
    if (!msCalendarId) {
      return next(new Error(`No MS calendar id found for calendar <${calendarUri}>`));
    } else {
      const msEvent = await client.createCalendarEvent(msCalendarId, payload);
      const event = await insertCalendarEvent(calendarUri, payload, msEvent);
      const attributes = Object.assign({}, event);
      delete attributes.id;
      return res.status(201).send({
        data: {
          id: event.id,
          type: 'calendar-events',
          attributes
        }
      });
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
      await deleteCalendarEvent(eventId);
      const client = new GraphApiClient(sessionUri);
      const msCalendarId = calendarManager.getMsCalendarId(event.calendar);
      await client.deleteCalendarEvent(msCalendarId, event.msId);
    }
    return res.status(204).send();
  } catch(e) {
    console.trace(e);
    return next(new Error(e.message));
  }
});

app.use(errorHandler);
