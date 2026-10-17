export type IssueCategory =
  | 'Infrastructure'
  | 'Electricity'
  | 'Water'
  | 'Cleanliness'
  | 'Internet'
  | 'Classroom Equipment'
  | 'Other';

export type IssueStatus =
  | 'Pending'
  | 'In Progress'
  | 'Resolved';

export type Urgency = 'Low' | 'Medium' | 'High';

// One complaint submitted by one student (or one "+1 I have this too").
// Note: the server never sends who reported it, only what was reported.
export interface Report {
  id: string;
  referenceNo: string;
  issueId: string;
  title: string;
  description: string;
  category: IssueCategory;
  building: string;
  room: string;
  locationDisplay: string;
  urgency?: Urgency;
  isSupport?: boolean;
  createdAt: string;
}

export interface StatusHistory {
  id: string;
  issueId: string;
  fromStatus?: IssueStatus;
  toStatus: IssueStatus;
  notes: string;
  changedBy: string;
  createdAt: string;
}

// A group of similar reports about the same problem (a "recurring problem").
export interface Issue {
  id: string;
  title: string;
  description: string;
  category: IssueCategory;
  building: string;
  room: string;
  locationDisplay: string;
  reportCount: number;
  // true when this browser has already counted on this issue
  reportedByMe?: boolean;
  status: IssueStatus;
  urgency?: Urgency;
  createdAt: string;
  updatedAt: string;
  reports?: Report[];
  history?: StatusHistory[];
}

export interface CampusStats {
  totalReports: number;
  totalIssues: number;
  awaitingResolution: number;
  resolvedIssues: number;
  categoryCounts: Record<IssueCategory, number>;
}

export interface FilterOptions {
  search: string;
  category: string;
  status: string;
  building: string;
  sortBy: 'most_reported' | 'newest' | 'recently_updated';
}

export interface AdminUser {
  id: string;
  username: string;
  name: string;
  role: 'superadmin' | 'campus_officer';
  avatar?: string;
}
