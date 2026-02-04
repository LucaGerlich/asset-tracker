# Ticket System Implementation

This PR adds a comprehensive ticket system to the Asset Tracker application with a kanban board for admins and a ticket submission interface for users.

## Features

### For Users
- **Create Tickets**: Submit support requests with title, description, and priority
- **View Tickets**: See all their submitted tickets with status indicators
- **Track Progress**: Monitor ticket status (New, In Progress, Completed, Cancelled)
- **Add Comments**: Communicate with admins through ticket comments
- **Priority Levels**: Set priority (Low, Medium, High, Urgent) when creating tickets

### For Administrators
- **Kanban Board**: Drag-and-drop interface to manage tickets across status columns
- **View All Tickets**: See all user-submitted tickets in one place
- **Update Status**: Move tickets between New, In Progress, and Completed columns
- **Assign Tickets**: Assign tickets to admin users
- **Change Priority**: Adjust ticket priority as needed
- **Add Comments**: Respond to users via ticket comments

## Database Schema

### Ticket Model
```prisma
model Ticket {
  id          String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  title       String    @db.VarChar(255)
  description String?
  status      String    @default("new") @db.VarChar(20)
  priority    String    @default("medium") @db.VarChar(20)
  createdBy   String    @db.Uuid
  assignedTo  String?   @db.Uuid
  createdAt   DateTime  @default(now()) @db.Timestamp(6)
  updatedAt   DateTime  @updatedAt @db.Timestamp(6)
}
```

### TicketComment Model
```prisma
model TicketComment {
  id        String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  ticketId  String   @db.Uuid
  userId    String   @db.Uuid
  comment   String
  createdAt DateTime @default(now()) @db.Timestamp(6)
}
```

## Installation & Setup

### 1. Install Dependencies
```bash
npm install
```

This includes the `@dnd-kit` packages for drag-and-drop functionality:
- `@dnd-kit/core`
- `@dnd-kit/sortable`
- `@dnd-kit/utilities`

### 2. Run Database Migration
```bash
npx prisma migrate dev
```

This will apply the migration located in:
`prisma/migrations/20260129132033_add_ticket_system/migration.sql`

### 3. Generate Prisma Client
```bash
npx prisma generate
```

### 4. Build the Application
```bash
npm run build
```

### 5. Start the Development Server
```bash
npm run dev
```

## Usage

### Accessing the Ticket System

#### For Regular Users:
1. Navigate to **"My Tickets"** from the main navigation menu
2. Or use the link in the user dropdown menu
3. URL: `/user/tickets`

#### For Administrators:
1. Navigate to **"Tickets"** from the main navigation menu
2. Or use the link in the user dropdown menu
3. URL: `/admin/tickets`

### Creating a Ticket (User)
1. Go to "My Tickets"
2. Click the **"New Ticket"** button
3. Fill in:
   - Title (required)
   - Description (optional)
   - Priority (Low, Medium, High, Urgent)
4. Click **"Create Ticket"**

### Managing Tickets (Admin)
1. Go to "Tickets" to view the kanban board
2. **Drag and drop** tickets between columns to change status
3. Click on a ticket to:
   - View details
   - Change status, priority, or assignee
   - Add comments
   - View conversation history

### Adding Comments
Both users and admins can add comments to tickets:
1. Click on a ticket to open the detail modal
2. Scroll to the comments section
3. Type your comment
4. Click **"Add Comment"**

## API Endpoints

### `GET /api/tickets`
Fetch tickets based on user role:
- **Admins**: Returns all tickets
- **Users**: Returns only their own tickets

### `POST /api/tickets`
Create a new ticket
- **Body**: `{ title, description?, priority? }`
- **Auth**: Any authenticated user

### `PATCH /api/tickets/[id]`
Update ticket status, priority, or assignment
- **Body**: `{ status?, priority?, assignedTo? }`
- **Auth**: Admin only

### `POST /api/tickets/[id]/comments`
Add a comment to a ticket
- **Body**: `{ comment }`
- **Auth**: Ticket creator or admin

## Technical Implementation

### Frontend Components

#### Admin Kanban Board (`/src/app/admin/tickets/ui/`)
- **KanbanBoard.tsx**: Main container with drag-and-drop context
- **TicketColumn.tsx**: Droppable column component
- **TicketCard.tsx**: Draggable ticket card component
- **TicketModal.tsx**: Detailed view and edit modal

#### User Interface (`/src/app/user/tickets/ui/`)
- **UserTicketsPage.tsx**: Main container for user tickets
- **NewTicketForm.tsx**: Ticket creation form
- **TicketList.tsx**: List view of user tickets
- **TicketDetailsModal.tsx**: View ticket details and add comments

### Shared Types
Type definitions are located in `/src/types/ticket.ts`:
- `Ticket`: Main ticket interface
- `TicketUser`: User information in tickets
- `TicketComment`: Comment structure

### Permissions
- **Ticket Creation**: Any authenticated user
- **View Tickets**: Users see only their tickets, admins see all
- **Update Tickets**: Admin only
- **Add Comments**: Ticket creator or admin

## Status Flow
```
New → In Progress → Completed
  ↓         ↓            ↓
       Cancelled
```

## Priority Levels
- **Low**: Non-urgent requests
- **Medium**: Standard priority (default)
- **High**: Important but not critical
- **Urgent**: Critical issues requiring immediate attention

## Navigation
Ticket links have been added to:
1. Main navigation menu (responsive)
2. User dropdown menu
3. Breadcrumb navigation on ticket pages

## Notes
- Ticket statuses are updated in real-time via optimistic updates
- Drag-and-drop requires a minimum distance threshold to prevent accidental moves
- All timestamps are displayed in the user's local timezone
- Comments are ordered chronologically (oldest first)
