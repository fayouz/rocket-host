// Donnees de demonstration (mode demo si DEMO=1 ou pas de jeton)
import type { Booking, Property } from './types'

const d = (n: number) => { const x = new Date(); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10) }
export const demoProperties: Property[] = [{ id: 1, name: 'Gaston' }, { id: 2, name: 'Le ponant' }]
export const demoBookings: Booking[] = [
  { id: 1, propertyId: 1, arrival: d(-3), departure: d(0), guest: 'Alex Martin', status: 'Booked', source: 'Airbnb', total: 210 },
  { id: 2, propertyId: 2, arrival: d(-1), departure: d(2), guest: 'Marc D.', status: 'Booked', source: 'Booking.com', total: 240 },
  { id: 3, propertyId: 1, arrival: d(0), departure: d(3), guest: 'Sofia R.', status: 'Booked', source: 'Airbnb', total: 205 },
  { id: 4, propertyId: 2, arrival: d(4), departure: d(6), guest: 'Paul M.', status: 'Booked', source: 'Manual', total: 140 },
  { id: 5, propertyId: 1, arrival: d(-40), departure: d(-36), guest: 'Anna K.', status: 'Booked', source: 'Airbnb', total: 300 },
  { id: 6, propertyId: 2, arrival: d(-20), departure: d(-15), guest: 'Tom B.', status: 'Booked', source: 'Booking.com', total: 380 },
]

import type { Lock } from './types'
const ago = (min: number) => new Date(Date.now() - min * 60000).toISOString()
export const demoLocks: Lock[] = [
  { id: 1, propertyId: 1, name: 'Gaston - Porte', state: 'Verrouillée', locked: true, battery: 82, batteryCritical: false, keypadBatteryCritical: false,
    logs: [{ date: ago(35), who: 'Sofia R.', action: 3, trigger: 255 }, { date: ago(300), who: 'Ménage', action: 2, trigger: 255 }] },
  { id: 2, propertyId: 2, name: 'Le ponant - Porte', state: 'Déverrouillée', locked: false, battery: 14, batteryCritical: true, keypadBatteryCritical: false,
    logs: [{ date: ago(12), who: 'Marc D.', action: 1, trigger: 255 }] },
]
