# Ticket System Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      Asset Tracker Application                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────┐                        ┌──────────────┐       │
│  │              │                        │              │       │
│  │  User View   │                        │  Admin View  │       │
│  │              │                        │              │       │
│  │ /user/tickets│                        │/admin/tickets│       │
│  │              │                        │              │       │
│  └──────┬───────┘                        └───────┬──────┘       │
│         │                                        │              │
│         │  ┌──────────────────────────────────┐  │              │
│         └─►│                                  │◄─┘              │
│            │         API Routes               │                 │
│            │                                  │                 │
│            │  POST   /api/tickets             │                 │
│            │  GET    /api/tickets             │                 │
│            │  PATCH  /api/tickets/[id]        │                 │
│            │  POST   /api/tickets/[id]/       │                 │
│            │         comments                 │                 │
│            │                                  │                 │
│            └────────────┬─────────────────────┘                 │
│                         │                                       │
│                         │                                       │
│            ┌────────────▼─────────────────────┐                 │
│            │                                  │                 │
│            │      PostgreSQL Database         │                 │
│            │                                  │                 │
│            │  ┌────────────────────────────┐  │                 │
│            │  │  Ticket Table              │  │                 │
│            │  │  - id                      │  │                 │
│            │  │  - title                   │  │                 │
│            │  │  - description             │  │                 │
│            │  │  - status                  │  │                 │
│            │  │  - priority                │  │                 │
│            │  │  - createdBy               │  │                 │
│            │  │  - assignedTo              │  │                 │
│            │  │  - timestamps              │  │                 │
│            │  └────────────────────────────┘  │                 │
│            │                                  │                 │
│            │  ┌────────────────────────────┐  │                 │
│            │  │  TicketComment Table       │  │                 │
│            │  │  - id                      │  │                 │
│            │  │  - ticketId (FK)           │  │                 │
│            │  │  - userId (FK)             │  │                 │
│            │  │  - comment                 │  │                 │
│            │  │  - createdAt               │  │                 │
│            │  └────────────────────────────┘  │                 │
│            │                                  │                 │
│            └──────────────────────────────────┘                 │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

## User Journey

### User Creates Ticket
```
User
  ↓
Navigate to /user/tickets
  ↓
Click "New Ticket"
  ↓
Fill form (title, description, priority)
  ↓
Submit → POST /api/tickets
  ↓
Ticket created with status="new"
  ↓
Appears in user's ticket list
```

### Admin Manages Ticket
```
Admin
  ↓
Navigate to /admin/tickets
  ↓
View Kanban Board
  ├─ Column: New
  ├─ Column: In Progress
  └─ Column: Completed
  ↓
Drag ticket to "In Progress"
  ↓
PATCH /api/tickets/[id] {status: "in_progress"}
  ↓
Ticket status updated
  ↓
Click ticket to open modal
  ↓
Select assignee / change priority / add comment
  ↓
Changes saved via API
```

### User Views Progress
```
User
  ↓
Navigate to /user/tickets
  ↓
See ticket list with status badges
  ├─ New (blue)
  ├─ In Progress (yellow)
  ├─ Completed (green)
  └─ Cancelled (gray)
  ↓
Click ticket to view details
  ↓
See comments from admin
  ↓
Add reply comment
  ↓
POST /api/tickets/[id]/comments
```

## Component Structure

### Admin Interface
```
/admin/tickets/
├── page.tsx                  (Server component - data fetching)
└── ui/
    ├── KanbanBoard.tsx       (Client - drag-and-drop context)
    ├── TicketColumn.tsx      (Client - droppable column)
    ├── TicketCard.tsx        (Client - draggable card)
    └── TicketModal.tsx       (Client - edit modal)
```

### User Interface
```
/user/tickets/
├── page.tsx                  (Server component - data fetching)
└── ui/
    ├── UserTicketsPage.tsx   (Client - main container)
    ├── NewTicketForm.tsx     (Client - ticket creation)
    ├── TicketList.tsx        (Client - list view)
    └── TicketDetailsModal.tsx (Client - view modal)
```

## Status Flow Diagram

```
    ┌─────────┐
    │   NEW   │
    │ (blue)  │
    └────┬────┘
         │
         ↓
  ┌──────────────┐
  │ IN PROGRESS  │
  │  (yellow)    │
  └─┬──────────┬─┘
    │          │
    ↓          ↓
┌──────────┐  ┌──────────┐
│COMPLETED │  │CANCELLED │
│ (green)  │  │  (gray)  │
└──────────┘  └──────────┘
```

## Permission Matrix

| Action                    | User | Admin |
|---------------------------|------|-------|
| Create Ticket             | ✅   | ✅    |
| View Own Tickets          | ✅   | ✅    |
| View All Tickets          | ❌   | ✅    |
| Update Ticket Status      | ❌   | ✅    |
| Change Priority           | ❌   | ✅    |
| Assign Tickets            | ❌   | ✅    |
| Comment on Own Ticket     | ✅   | ✅    |
| Comment on Any Ticket     | ❌   | ✅    |
| Delete Tickets            | ❌   | ❌*   |

*Delete not implemented - tickets can be cancelled instead

## API Response Examples

### GET /api/tickets (User)
```json
[
  {
    "id": "uuid",
    "title": "Need new laptop",
    "description": "My current laptop is broken",
    "status": "in_progress",
    "priority": "high",
    "createdBy": "user-uuid",
    "assignedTo": "admin-uuid",
    "createdAt": "2026-01-29T13:00:00Z",
    "updatedAt": "2026-01-29T14:00:00Z",
    "creator": {
      "userid": "user-uuid",
      "firstname": "John",
      "lastname": "Doe",
      "email": "john@example.com"
    },
    "assignee": {
      "userid": "admin-uuid",
      "firstname": "Admin",
      "lastname": "User"
    },
    "comments": [
      {
        "id": "comment-uuid",
        "comment": "Looking into this now",
        "createdAt": "2026-01-29T14:00:00Z",
        "user": {
          "firstname": "Admin",
          "lastname": "User"
        }
      }
    ]
  }
]
```

## Technology Stack

- **Frontend**: React 19, Next.js 16
- **UI Components**: Radix UI
- **Styling**: Tailwind CSS
- **Drag & Drop**: @dnd-kit
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Authentication**: NextAuth v5
- **Type Safety**: TypeScript
