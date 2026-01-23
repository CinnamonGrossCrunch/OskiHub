# EWMBA Hub Development Setup

## Recent Upgrades (September 2025)

### ✅ TypeScript 5.9.2
- **Status**: Already upgraded and active
- **Benefits**: Latest language improvements, better IntelliSense, expandable hovers
- **Features**: Import defer support, improved DOM APIs documentation

### 🚀 MCP (Model Context Protocol) Integration
- **Location**: `lib/mcp-server.js`
- **Configuration**: `.vscode/settings.json`
- **Benefits**: AI-enhanced newsletter processing and data sourcing

#### Available MCP Tools:
1. **`scrape_newsletter`** - Enhanced web scraping with AI categorization
2. **`parse_calendar_events`** - Intelligent cohort detection and categorization
3. **`generate_event_summary`** - AI-powered event summaries with urgency indicators

#### Usage:
```bash
# Start MCP server
node lib/mcp-server.js

# VS Code will auto-start when chat.mcp.autostart is enabled
```

### 🌳 Git Worktrees Setup
Multiple parallel development environments for different features:

#### Available Worktrees:
```bash
# Main development (current)
C:/Users/Computer/Dropbox/EWMBA Hub/newsletter-widget [main]

# Calendar feature development
C:/Users/Computer/Dropbox/EWMBA Hub/newsletter-widget-calendar [feature/enhanced-calendar]

# Dashboard enhancements
C:/Users/Computer/Dropbox/EWMBA Hub/newsletter-widget-dashboard [feature/dashboard-enhancements]

# MCP integrations
C:/Users/Computer/Dropbox/EWMBA Hub/newsletter-widget-mcp [feature/mcp-integrations]
```

#### Worktree Commands:
```bash
# List all worktrees
git worktree list

# Switch to a worktree
cd "../newsletter-widget-calendar"

# Create new worktree
git worktree add ../newsletter-widget-newfeature feature/new-feature

# Remove worktree (when feature is complete)
git worktree remove ../newsletter-widget-calendar
```

## Development Workflow

### Parallel Feature Development:
1. **Calendar Features** → Work in `newsletter-widget-calendar/`
2. **Dashboard UI** → Work in `newsletter-widget-dashboard/`
3. **MCP/AI Features** → Work in `newsletter-widget-mcp/`
4. **Main Integration** → Work in `newsletter-widget/`

### VS Code Integration:
- Open multiple VS Code instances for different worktrees
- Each worktree maintains its own TypeScript language server
- MCP tools available in VS Code Chat when configured

### Benefits:
- ✅ **No context switching** - work on multiple features simultaneously
- ✅ **Isolated environments** - test features without affecting main branch
- ✅ **AI-enhanced processing** - MCP tools for smarter data handling
- ✅ **Latest TypeScript** - 5.9.2 with all modern features
- ✅ **Performance optimized** - better IntelliSense and type checking

## Next Steps:
1. **Test MCP integration** - Try the new AI tools in VS Code Chat
2. **Explore worktrees** - Start developing features in parallel
3. **Leverage TypeScript 5.9** - Use new language features and improved tooling
4. **Consider remote MCP servers** - Connect to external AI services for enhanced processing
