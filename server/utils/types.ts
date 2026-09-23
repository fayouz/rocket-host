export interface Property { id: number; name: string; original?: string; internalName?: string; latitude?: number; longitude?: number }
export interface Booking {
  id: number
  propertyId: number
  arrival: string   // YYYY-MM-DD
  departure: string // YYYY-MM-DD
  guest: string
  status: string
  source: string
  total: number
  checkIn?: string  // HH:MM, politique du logement dans Lodgify
  checkOut?: string // HH:MM
  threadUid?: string // fil de messages Lodgify
  guestEmail?: string // e-mail du voyageur (souvent une adresse relais Airbnb/Booking) : sert a rattacher les e-mails
}
export interface BookingWithProperty extends Booking { property: string }
export interface LockLog { date: string; who: string; action: number; trigger: number }
export interface Lock {
  id: number
  propertyId: number | null
  name: string
  state: string
  locked: boolean
  battery: number | null
  batteryCritical: boolean
  keypadBatteryCritical: boolean
  logs: LockLog[]
}
export interface AccessCode {
  booking_id: number
  lock_id: number
  code: string
  valid_from: string  // ISO UTC
  valid_until: string // ISO UTC
  status: 'planned' | 'created' | 'error'
  error: string | null
  created_at: string | null
}
export interface SentMessage { id: number; at: string; subject: string; channel: string; status: string }
export interface MessageRule { id: number; name: string; anchor: 'arrival' | 'departure'; offset_days: number; send_time: string; channels: string }
