export interface TicketUser {
  userid: string;
  username: string | null;
  firstname: string;
  lastname: string;
  email?: string | null;
}

export interface TicketComment {
  id: string;
  comment: string;
  createdAt: Date;
  user: {
    userid: string;
    username: string | null;
    firstname: string;
    lastname: string;
  };
}

export interface Ticket {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  createdBy: string;
  assignedTo: string | null;
  createdAt: Date;
  updatedAt: Date;
  creator: TicketUser;
  assignee: TicketUser | null;
  comments: TicketComment[];
}
