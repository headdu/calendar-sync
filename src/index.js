import ICAL from 'ical.js';
import {google} from 'googleapis';

const serviceAccount = JSON.parse(Buffer.from(process.env.GOOGLE_KEY, 'base64').toString());
const jwtClient = new google.auth.JWT(
  serviceAccount.client_email,
  null,
  serviceAccount.private_key,
  ['https://www.googleapis.com/auth/calendar']
);
const calendar = google.calendar({ version: 'v3', auth: jwtClient });
const calendarId = process.env.CALENDAR_ID;

async function findExistingEvent(uid) {
  try {
    const response = await calendar.events.list({
      calendarId: calendarId,

      q: uid, // Search for the UID in the event description
    });

    return response.data.items[0]; // Return the first matching event, if any
  } catch (error) {
    console.error('Error searching for existing event:', error);
    return null;
  }
}

async function createOrUpdateGoogleCalendarEvent(event) {
  const uid = event.uid;
  const existingEvent = await findExistingEvent(uid);

  const eventResource = {
    summary: event.summary,
    description: uid,
    start: {
      dateTime: event.startDate.toJSDate().toISOString(),
      timeZone: 'UTC', // Adjust as needed
    },
    end: {
      dateTime: event.endDate.toJSDate().toISOString(),
      timeZone: 'UTC', // Adjust as needed
    },
  };

  try {
    let response;
    if (existingEvent) {
      response = await calendar.events.update({
        calendarId: calendarId,
        eventId: existingEvent.id,
        resource: eventResource,
      });
      console.log('Event updated:');
    } else {
      response = await calendar.events.insert({
        calendarId: calendarId,
        resource: eventResource,
      });
      console.log('Event created:');
    }
  } catch (error) {
    console.error('Error creating/updating event:', error);
  }
}


async function downloadAndProcessICSFile(url) {
  try {
    // Download the ICS file
    const icsData = await fetch(url).then(res => res.text());
    
    // const icsData = response.data;

    // Parse the ICS data
    const jcalData = ICAL.parse(icsData);
    const vcalendar = new ICAL.Component(jcalData);
    const vevents = vcalendar.getAllSubcomponents('vevent');

    // Process each event
    for (const vevent of vevents) {
      const event = new ICAL.Event(vevent);

      console.log('Processing Event:', event.summary, event.uid);
      await createOrUpdateGoogleCalendarEvent(event);
      console.log('---');
    }
  } catch (error) {
    console.error('Error downloading or processing ICS file:', error);
  }
}

const icsUrl = process.env.ICS_CALENDAR;
downloadAndProcessICSFile(icsUrl).catch(console.error);