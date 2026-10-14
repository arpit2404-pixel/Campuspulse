export type IssueCategory = 
  | 'Electrical' 
  | 'Plumbing' 
  | 'Classroom Equipment' 
  | 'Cleanliness' 
  | 'Infrastructure' 
  | 'Safety' 
  | 'Other';

export type IssueStatus = 
  | 'Pending' 
  | 'Under Review' 
  | 'In Progress' 
  | 'Resolved';

export interface Report {
  id: string;
  referenceNo: string;
  issueId: string;
  reporterId?: string;
  title: string;
  description: string;
  category: IssueCategory;
  building: string;
  room: string;
  locationDisplay: string;
  imageUrl?: string;
  isAnonymous: boolean;
  reporterContact?: string;
  createdAt: string;
  isDemo?: boolean;
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

export interface Issue {
  id: string;
  title: string;
  description: string;
  category: IssueCategory;
  building: string;
  room: string;
  locationDisplay: string;
  reportCount: number;
  uniqueReporterIds?: string[];
  status: IssueStatus;
  createdAt: string;
  updatedAt: string;
  isDemo?: boolean;
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
