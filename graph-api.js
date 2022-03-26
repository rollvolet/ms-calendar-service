import 'isomorphic-fetch';
import { Client } from '@microsoft/microsoft-graph-client';
import MuAuthenticationProvider from './mu-authentication-provider';

const CUSTOMER_VISIT_START_HOUR = process.env.VISIT_START_HOUR || 17;
const PLANNING_START_HOUR = process.env.PLANNING_START_HOUR || 19;

function toMsDate(date, hours, minutes = 0, seconds = 0) {
  const clone = new Date(date);
  clone.setHours(hours);
  clone.setMinutes(minutes);
  clone.setSeconds(seconds);
  const isoDate = clone.toISOString();
  const dateStr = isoDate.substr(0, 'YYYY-MM-DDTHH:mm:ss'.length);

  return {
    dateTime: dateStr,
    timeZone: 'Romance Standard Time'
  };
}

function toMsEvent(event, requiresReschedule = true) {
  let htmlBody = '';
  if (event.description) {
    htmlBody += `<p>${event.description}</p>`;
  }
  if (event.url) {
    htmlBody += `<p>RKB: <a href=${event.url}>${event.url}</a></p>`;
  }
  const msEvent = {
    subject: event.subject,
    body: {
      contentType: 'html',
      content: htmlBody
    },
    location: {
      displayName: event.location
    },
    isReminderOn: false
  };

  if (requiresReschedule) {
    msEvent.start = toMsDate(event.date, CUSTOMER_VISIT_START_HOUR);
    msEvent.end = toMsDate(event.date, CUSTOMER_VISIT_START_HOUR + 1);
  }

  return msEvent;
}

/**
 * Client to interact with the MS Graph API. Requests are executed on behalf of a user.
 * The client uses the mu-authentication-provider which fetches an access-token from
 * the triplestore based on the user's session.
 *
 * Note: This client is not responsible for inserting/deleting data in the triplestore,
 * only for interacting with the O365 Cloud using the Graph API.
*/
export default class GraphApiClient {
  constructor(sessionUri) {
    this.client = Client.initWithMiddleware({
      authProvider: new MuAuthenticationProvider(sessionUri)
    });
  }

  async createCalendarEvent(calendarId, event) {
    console.log(`Creating calendar event on ${event.date} in MS calendar ${calendarId}`);
    const msEvent = toMsEvent(event);
    const path = `/users/${calendarId}/calendar/events`;
    const response = await this.client.api(path).post(msEvent);
    return response;
  }

  async updateCalendarEvent(calendarId, event, requiresReschedule) {
    console.log(`Updating calendar event with id ${event['ms-identifier']} in MS calendar ${calendarId}`);
    const msEvent = toMsEvent(event, requiresReschedule);
    const path = `/users/${calendarId}/calendar/events/${event['ms-identifier']}`;
    try {
      const response = await this.client.api(path).update(msEvent);
      return response;
    } catch (e) {
      if (e && e.statusCode == 404) {
        console.log(`Event with id ${event['ms-identifier']} not found in MS calendar ${calendarId}. Going to create a new calendar event.`);
        const newEvent = await this.createCalendarEvent(calendarId, event);
        return newEvent;
      } else {
        throw e;
      }
    }
  }

  async deleteCalendarEvent(calendarId, msId) {
    console.log(`Deleting calendar event with id ${msId} from MS calendar ${calendarId}`);
    try {
      await this.client.api(`/users/${calendarId}/calendar/events/${msId}`).delete();
    } catch (e) {
      if (e && e.statusCode == 404) {
        console.log(`Event with id ${msId} not found in MS calendar ${calendarId}. Nothing to delete via Graph API.`);
      } else {
        console.log(`Something went wrong while deleting calendar event with id ${msId} from MS calendar ${calendarId}. Event may need to be deleted manually in the calendar.`);
      }
    }
  }
}
