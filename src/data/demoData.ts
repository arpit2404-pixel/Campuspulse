import { IssueCategory } from '../types';

// Lists used by the report form and filters. There is NO sample complaint data
// here: all complaints come from the database through the API.

export const CAMPUS_BUILDINGS = [
  'Administrative Block',
  'Computer Science Block',
  'EEE Block',
  'ECE Block',
  'Central Library',
  'Mechanical Block',
  'Canteen & Cafeteria',
  'Girls Hostel Block',
  'Boys Hostel Block',
  'Campus Grounds & Sports'
];

export const CATEGORIES: { name: IssueCategory; icon: string; description: string }[] = [
  { name: 'Infrastructure', icon: 'Building2', description: 'Desks, chairs, broken doors, windows, paint, railings' },
  { name: 'Electricity', icon: 'Zap', description: 'Lights, fans, wiring, switches, power sockets' },
  { name: 'Water', icon: 'Droplets', description: 'Taps, leaks, water coolers, pipes, washbasins' },
  { name: 'Cleanliness', icon: 'Sparkles', description: 'Washrooms, litter, bins, cafeteria sanitation' },
  { name: 'Internet', icon: 'Wifi', description: 'Wi-Fi, LAN ports, slow or no connection' },
  { name: 'Classroom Equipment', icon: 'Tv', description: 'Projectors, smartboards, microphones, screens' },
  { name: 'Other', icon: 'HelpCircle', description: 'Other campus facilities and amenities' }
];
