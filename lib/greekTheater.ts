import type { CalendarEvent } from './icsUtils';

export interface GreekTheaterEvent {
  date: Date;
  title: string;
  url: string;
  showTime?: string;
  doorsTime?: string;
}

// Convert Greek Theater event to CalendarEvent format for the modal
export function greekTheaterToCalendarEvent(greekEvent: GreekTheaterEvent): CalendarEvent {
  // Use local date components to create ISO string, avoiding UTC shift
  // Greek Theater dates are constructed with new Date(year, month, day) (local timezone)
  const d = greekEvent.date;
  const localIso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T12:00:00`;
  return {
    uid: `greek-${greekEvent.date.getTime()}`,
    title: ` ${greekEvent.title}`,
    start: localIso,
    end: localIso,
    description: `Greek Theater Berkeley presents: ${greekEvent.title}${greekEvent.showTime ? `\n\nShow Time: ${greekEvent.showTime}` : ''}${greekEvent.doorsTime ? `\nDoors: ${greekEvent.doorsTime}` : ''}\n\nGet tickets: ${greekEvent.url}`,
    url: greekEvent.url,
    location: 'Greek Theater, Berkeley, CA'
  };
}

export function parseGreekTheaterEvents(): GreekTheaterEvent[] {
  // For now, manually extract the events from the HTML file
  // In a production environment, you might want to parse the HTML dynamically
  const events: GreekTheaterEvent[] = [
    // August 2025
    {
      date: new Date(2025, 7, 28), // Month is 0-indexed
      title: "Pixies, Spoon, & Fazerdaze",
      url: "https://thegreekberkeley.com/events/pixies-250828",
      showTime: "6:00 pm",
      doorsTime: "5:00 pm"
    },
    {
      date: new Date(2025, 7, 30),
      title: "Angélique Kidjo & Yo-Yo Ma",
      url: "https://thegreekberkeley.com/events/angelique-kidjo-and-yo-yo-ma-250830",
      showTime: "8:00 pm"
    },
    
    // September 2025
    {
      date: new Date(2025, 8, 4),
      title: "Goo Goo Dolls & Dashboard Confessional",
      url: "https://thegreekberkeley.com/events/goo-goo-dolls-250904",
      showTime: "6:30 pm",
      doorsTime: "5:30 pm"
    },
    {
      date: new Date(2025, 8, 5),
      title: "Teddy Swims & Cian Ducrot",
      url: "https://thegreekberkeley.com/events/teddy-swims-250905",
      showTime: "8:00 pm",
      doorsTime: "6:30 pm"
    },
    {
      date: new Date(2025, 8, 7),
      title: "The Flaming Lips, Modest Mouse & Dehd",
      url: "https://thegreekberkeley.com/events/the-flaming-lips-modest-mouse-250907",
      showTime: "6:00 pm",
      doorsTime: "5:00 pm"
    },
    {
      date: new Date(2025, 8, 11),
      title: "Gregory Alan Isakov with Josiah and the Bonnevilles",
      url: "https://thegreekberkeley.com/events/gregory-alan-isakov-250911",
      showTime: "7:00 pm",
      doorsTime: "5:30 pm"
    },
    {
      date: new Date(2025, 8, 12),
      title: "Bomba Estéreo & Rawayana, Sofía Valdés",
      url: "https://thegreekberkeley.com/events/bomba-estereo-rawayana-250912",
      showTime: "8:00 pm",
      doorsTime: "6:30 pm"
    },
    {
      date: new Date(2025, 8, 14),
      title: "Billy Idol & Joan Jett and The Blackhearts",
      url: "https://thegreekberkeley.com/events/billy-idol-250914",
      showTime: "6:30 pm",
      doorsTime: "5:30 pm"
    },
    {
      date: new Date(2025, 8, 18),
      title: "Coheed and Cambria, Taking Back Sunday, Foxing",
      url: "https://thegreekberkeley.com/events/coheed-and-cambria-taking-back-sunday-250918",
      showTime: "6:00 pm",
      doorsTime: "5:00 pm"
    },
    {
      date: new Date(2025, 8, 19),
      title: "Mac DeMarco, Vicky Farewell, Daryl Johns",
      url: "https://thegreekberkeley.com/events/mac-demarco-250919",
      showTime: "7:30 pm",
      doorsTime: "6:00 pm"
    },
    {
      date: new Date(2025, 8, 20),
      title: "Mac DeMarco, Mock Media, Daryl Johns",
      url: "https://thegreekberkeley.com/events/mac-demarco-250920",
      showTime: "7:30 pm",
      doorsTime: "6:00 pm"
    },
    {
      date: new Date(2025, 8, 24),
      title: "The Head and The Heart, The Teskey Brothers, Tyler Ballgame",
      url: "https://thegreekberkeley.com/events/the-head-and-the-heart-250924",
      showTime: "6:00 pm",
      doorsTime: "5:00 pm"
    },
    {
      date: new Date(2025, 8, 25),
      title: "Big Thief",
      url: "https://thegreekberkeley.com/events/big-thief-250925",
      showTime: "7:00 pm",
      doorsTime: "5:30 pm"
    },
    {
      date: new Date(2025, 8, 27),
      title: "Disclosure",
      url: "https://thegreekberkeley.com/events/disclosure-250927",
      showTime: "7:00 pm",
      doorsTime: "6:00 pm"
    },
    
    // October 2025
    {
      date: new Date(2025, 9, 3),
      title: "Big Wild, Shallou",
      url: "https://thegreekberkeley.com/events/big-wild-251003",
      showTime: "8:00 pm",
      doorsTime: "6:30 pm"
    },
    {
      date: new Date(2025, 9, 11),
      title: "Morrissey",
      url: "https://thegreekberkeley.com/events/morrissey-251011",
      showTime: "8:00 pm",
      doorsTime: "7:00 pm"
    },
    {
      date: new Date(2025, 9, 13),
      title: "Parcels",
      url: "https://thegreekberkeley.com/events/parcels-251013",
      showTime: "7:00 pm",
      doorsTime: "5:30 pm"
    },
    {
      date: new Date(2025, 9, 15),
      title: "Lord Huron, Kevin Morby",
      url: "https://thegreekberkeley.com/events/lord-huron-251015",
      showTime: "7:00 pm",
      doorsTime: "5:30 pm"
    },
    {
      date: new Date(2025, 9, 16),
      title: "Rilo Kiley, Waxahatchee",
      url: "https://thegreekberkeley.com/events/rilo-kiley-251016",
      showTime: "7:00 pm",
      doorsTime: "5:30 pm"
    },
    {
      date: new Date(2025, 9, 18),
      title: "Djo, Post Animal",
      url: "https://thegreekberkeley.com/events/djo-251018",
      showTime: "8:00 pm",
      doorsTime: "6:30 pm"
    },
    {
      date: new Date(2025, 9, 19),
      title: "Lorde, The Japanese House, Empress Of",
      url: "https://thegreekberkeley.com/events/lorde-251019",
      showTime: "6:00 pm",
      doorsTime: "4:30 pm"
    },

    // April 2026
    {
      date: new Date(2026, 3, 16),
      title: "Royel Otis & STRFKR",
      url: "https://thegreekberkeley.com/events/royel-otis-260416",
      showTime: "7:00 pm"
    },

    // May 2026
    {
      date: new Date(2026, 4, 3),
      title: "Lewis Capaldi",
      url: "https://thegreekberkeley.com/events/lewis-capaldi-260503",
      showTime: "7:00 pm"
    },
    {
      date: new Date(2026, 4, 29),
      title: "Alabama Shakes",
      url: "https://thegreekberkeley.com/events/alabama-shakes-260529",
      showTime: "8:00 pm"
    },
    {
      date: new Date(2026, 4, 30),
      title: "Alabama Shakes",
      url: "https://thegreekberkeley.com/events/alabama-shakes-260530",
      showTime: "8:00 pm"
    },

    // June 2026
    {
      date: new Date(2026, 5, 11),
      title: "James Blake",
      url: "https://thegreekberkeley.com/events/james-blake-260611",
      showTime: "7:00 pm"
    },
    {
      date: new Date(2026, 5, 26),
      title: "Khalid",
      url: "https://thegreekberkeley.com/events/khalid-260626",
      showTime: "8:00 pm"
    },

    // July 2026
    {
      date: new Date(2026, 6, 17),
      title: "Bob Moses & Cannons",
      url: "https://thegreekberkeley.com/events/bob-moses-cannons-260717",
      showTime: "7:30 pm"
    },
    {
      date: new Date(2026, 6, 18),
      title: "Rainbow Kitten Surprise",
      url: "https://thegreekberkeley.com/events/rainbow-kitten-surprise-260718",
      showTime: "8:00 pm"
    },
    {
      date: new Date(2026, 6, 19),
      title: "Young the Giant",
      url: "https://thegreekberkeley.com/events/young-the-giant-260719",
      showTime: "6:00 pm"
    },
    {
      date: new Date(2026, 6, 23),
      title: "The Fray",
      url: "https://thegreekberkeley.com/events/the-fray-260723",
      showTime: "6:00 pm"
    },

    // August 2026
    {
      date: new Date(2026, 7, 12),
      title: "Tedeschi Trucks Band",
      url: "https://thegreekberkeley.com/events/tedeschi-trucks-band-260812",
      showTime: "6:00 pm"
    },
    {
      date: new Date(2026, 7, 15),
      title: "Thee Sacred Souls",
      url: "https://thegreekberkeley.com/events/thee-sacred-souls-260815",
      showTime: "7:00 pm"
    },
    {
      date: new Date(2026, 7, 29),
      title: "Tori Amos",
      url: "https://thegreekberkeley.com/events/tori-amos-260829",
      showTime: "8:00 pm"
    },

    // September 2026
    {
      date: new Date(2026, 8, 17),
      title: "Bleachers",
      url: "https://thegreekberkeley.com/events/bleachers-260917",
      showTime: "6:30 pm"
    },
    {
      date: new Date(2026, 8, 30),
      title: "Jack Johnson",
      url: "https://thegreekberkeley.com/events/jack-johnson-260930",
      showTime: "6:30 pm"
    },

    // October 2026
    {
      date: new Date(2026, 9, 1),
      title: "Jack Johnson",
      url: "https://thegreekberkeley.com/events/jack-johnson-251001",
      showTime: "6:30 pm"
    }
  ];

  return events;
}

export function getGreekTheaterEventsForDate(date: Date): GreekTheaterEvent[] {
  const events = parseGreekTheaterEvents();
  return events.filter(event => 
    event.date.getFullYear() === date.getFullYear() &&
    event.date.getMonth() === date.getMonth() &&
    event.date.getDate() === date.getDate()
  );
}

export function hasGreekTheaterEventOnDate(date: Date): boolean {
  return getGreekTheaterEventsForDate(date).length > 0;
}
