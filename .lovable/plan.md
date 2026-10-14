# Team Kanban Board with AI Assistant

## What you'll get
- **Sign in** (email/password) so your team can share boards.
- **Boards**: create several boards; every signed-in teammate can see and edit them.
- **Columns**: To Do, In Progress, Done (count shown in each header, "+" to add a card).
- **Cards**: title and description. Drag and drop between and within columns, with a lifted, tilted card while dragging and a dashed "drop here" area, like the reference.
- **AI assistant panel** on the right (where the calendar sits in the reference): ask questions about the board, or tell it to create, move, edit or delete cards. Multiple saved chat threads with a thread list and "New chat".
- Everything is saved, so it's all there when you come back.

## Design (from the reference)
- Soft light-gray canvas, white rounded app shell with large radius and gentle shadows.
- Left sidebar: logo, nav (Boards, Chat, Settings), user profile at the bottom.
- Top bar: search, "+ New card" dark pill button.
- Large bold board title with an edit icon, tabs underneath.
- Orange as the main accent color, small colored labels, near-black buttons.
- Smooth hover lift, drag animations, friendly empty states.
- Clean geometric font (e.g. Outfit + Figtree), not Inter.

## Pages
- `/auth` – sign in / sign up
- `/` – board list (redirects into your latest board)
- `/board/$boardId` – the kanban board with the AI panel
- `/board/$boardId/chat/$threadId` – same board with a specific chat thread open

## Technical details
- Lovable Cloud: auth, tables `profiles`, `boards`, `cards` (board_id, column, title, description, position), `chat_threads`, `chat_messages` (UIMessage JSON). RLS: any authenticated user can read/write boards & cards (shared team); threads/messages are private to their owner.
- Drag and drop with `@dnd-kit`; optimistic updates via TanStack Query, persisted positions.
- AI: server route streaming via AI SDK + Lovable AI Gateway (`openai/gpt-6-astra`, Responses API) with tools: `list_cards`, `create_card`, `update_card`, `move_card`, `delete_card`. Board refreshes after tool calls. AI Elements for chat UI, markdown rendering, collapsed tool cards.
- Each route gets its own page title/description.
