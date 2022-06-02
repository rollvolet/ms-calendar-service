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
      displayName: event.location,
      address: {
        street: event.street,
        postalCode: event['postal-code'],
        city: event.city,
        countryOrRegion: event.country
      },
    },
    isReminderOn: false
  };

  if (requiresReschedule) {
    // TODO Type must be determined based on SPARQL query
    let hour;
    const subject = event.request || event.intervention || event.order;
    if (subject.startsWith('http://data.rollvolet.be/requests/')) {
      hour = CUSTOMER_VISIT_START_HOUR;
    } else {
      hour = PLANNING_START_HOUR;
    }

    msEvent.start = toMsDate(event.date, hour);
    msEvent.end = toMsDate(event.date, hour + 1);
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
    const basePath = calendarId ? `/users/${calendarId}` : `/me`;
    console.log(`Creating calendar event on ${event.date} in MS calendar ${basePath}`);
    const msEvent = toMsEvent(event);
    const path = `${basePath}/calendar/events`;
    const response = await this.client.api(path).post(msEvent);
    return response;
  }

  async getCalendarEvent(calendarId, event) {
    const basePath = calendarId ? `/users/${calendarId}` : `/me`;
    console.log(`Fetching calendar event with id ${event['ms-identifier']} in MS calendar ${basePath}`);
    const path = `${basePath}/calendar/events/${event['ms-identifier']}`;
    try {
      const response = await this.client.api(path).get();
      const date = response.start.dateTime.substr(0, "YYYY-MM-DD".length);
      return {
        'ms-identifier': response.id,
        date: date
      };
    } catch (e) {
      if (e && e.statusCode == 404) {
        console.log(`Event with id ${event['ms-identifier']} not found in MS calendar ${basePath}.`);
        return null;
      } else {
        throw e;
      }
    }
  }

  async updateCalendarEvent(calendarId, event, requiresReschedule) {
    const basePath = calendarId ? `/users/${calendarId}` : `/me`;
    console.log(`Updating calendar event with id ${event['ms-identifier']} in MS calendar ${basePath}`);
    const msEvent = toMsEvent(event, requiresReschedule);
    const path = `${basePath}/calendar/events/${event['ms-identifier']}`;
    try {
      const response = await this.client.api(path).update(msEvent);
      return response;
    } catch (e) {
      if (e && e.statusCode == 404) {
        console.log(`Event with id ${event['ms-identifier']} not found in MS calendar ${basePath}. Going to create a new calendar event.`);
        const newEvent = await this.createCalendarEvent(calendarId, event);
        return newEvent;
      } else {
        throw e;
      }
    }
  }

  async deleteCalendarEvent(calendarId, msId) {
    const basePath = calendarId ? `/users/${calendarId}` : `/me`;
    console.log(`Deleting calendar event with id ${msId} from MS calendar ${basePath}`);
    try {
      await this.client.api(`${basePath}/calendar/events/${msId}`).delete();
    } catch (e) {
      if (e && e.statusCode == 404) {
        console.log(`Event with id ${msId} not found in MS calendar ${calendarId}. Nothing to delete via Graph API.`);
      } else {
        console.log(`Something went wrong while deleting calendar event with id ${msId} from MS calendar ${basePath}. Event may need to be deleted manually in the calendar.`);
      }
    }
  }
}
