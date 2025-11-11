# Interactive Components Guide

## Overview

Your chat system supports rich interactive components that can be embedded in AI responses. These components make troubleshooting more engaging and efficient by providing buttons, forms, progress bars, and more.

## Architecture

### Frontend (ChatBot.tsx)
- Parses `interactive_components` array from AI responses
- Renders components based on `type` field
- Handles user interactions (button clicks, form submissions)
- Auto-sends messages when users interact with components

### Backend (Edge Functions)
- System prompt instructs AI to use interactive components
- AI includes components in the `interactive_components` array of responses
- Components are returned as part of the structured answer JSON

## Component Schema

All interactive components follow this structure:

```typescript
interface InteractiveComponent {
  type: string;           // Component type (see below)
  id?: string;           // Optional unique identifier
  data: {                // Type-specific data
    // varies by component type
  }
}
```

## Available Component Types

### 1. Button Group
**Use case:** Present 2-5 multiple choice options for quick selection

```json
{
  "type": "button_group",
  "id": "symptom-selector",
  "data": {
    "title": "What symptoms are you seeing?",
    "buttons": [
      {
        "label": "No Power",
        "variant": "outline",
        "autoSendMessage": "The machine has no power"
      },
      {
        "label": "Intermittent Issues",
        "variant": "outline",
        "autoSendMessage": "Power comes and goes randomly"
      },
      {
        "label": "Error Codes",
        "variant": "outline",
        "autoSendMessage": "Display shows error codes"
      }
    ]
  }
}
```

**Fields:**
- `title`: Question or prompt text
- `buttons`: Array of button objects
  - `label`: Button text
  - `variant`: "default" | "outline" | "secondary"
  - `autoSendMessage`: Message sent when button is clicked

### 2. Progress Bar
**Use case:** Show completion status for multi-step procedures

```json
{
  "type": "progress",
  "id": "diagnostic-progress",
  "data": {
    "label": "Running Diagnostic Tests",
    "value": 65,
    "description": "Testing power supply connections..."
  }
}
```

**Fields:**
- `label`: Main progress label
- `value`: Progress percentage (0-100)
- `description`: Optional status message

### 3. Status Indicator
**Use case:** Display diagnostic results with visual feedback

```json
{
  "type": "status",
  "id": "connection-status",
  "data": {
    "icon": "✓",
    "status": "success",
    "title": "Connection Verified",
    "message": "All systems operational"
  }
}
```

**Fields:**
- `icon`: Emoji or symbol to display
- `status`: "success" | "warning" | "error" | "info"
- `title`: Main status title
- `message`: Detailed status message

### 4. Interactive Checklist
**Use case:** Guide users through safety checks or multi-step procedures

```json
{
  "type": "checklist",
  "id": "safety-checks",
  "data": {
    "title": "Pre-Flight Safety Checks",
    "items": [
      {
        "label": "Power disconnected from mains",
        "checked": false
      },
      {
        "label": "All cabinet doors locked",
        "checked": false
      },
      {
        "label": "Work area clear of obstructions",
        "checked": false
      }
    ]
  }
}
```

**Fields:**
- `title`: Checklist title
- `items`: Array of checklist items
  - `label`: Item text
  - `checked`: Initial checked state (boolean)

### 5. Text Input
**Use case:** Collect specific text data like error codes or part numbers

```json
{
  "type": "input",
  "id": "error-code-input",
  "data": {
    "label": "Error Code Number",
    "placeholder": "e.g., E42-7",
    "description": "Enter the exact code shown on the display",
    "inputType": "text",
    "maxLength": 20
  }
}
```

**Fields:**
- `label`: Input field label
- `placeholder`: Placeholder text
- `description`: Helper text
- `inputType`: "text" | "number" | "email"
- `maxLength`: Maximum character length

### 6. Dropdown Select
**Use case:** Choose from predefined options

```json
{
  "type": "select",
  "id": "cabinet-model",
  "data": {
    "label": "Game Cabinet Model",
    "placeholder": "Select your model",
    "description": "Select the cabinet type for accurate diagnostics",
    "options": [
      {"value": "classic", "label": "Classic Upright"},
      {"value": "cocktail", "label": "Cocktail Table"},
      {"value": "mini", "label": "Mini Cabinet"}
    ]
  }
}
```

**Fields:**
- `label`: Select field label
- `placeholder`: Placeholder text
- `description`: Helper text
- `options`: Array of option objects
  - `value`: Option value
  - `label`: Display text

### 7. Slider Control
**Use case:** Adjust numeric values or ratings

```json
{
  "type": "slider",
  "id": "severity-rating",
  "data": {
    "label": "Issue Severity Level",
    "min": 0,
    "max": 100,
    "step": 10,
    "defaultValue": 50,
    "description": "Rate from 0 (minor) to 100 (critical)"
  }
}
```

**Fields:**
- `label`: Slider label
- `min`: Minimum value
- `max`: Maximum value
- `step`: Increment step
- `defaultValue`: Initial value
- `description`: Helper text

### 8. Multi-Field Form
**Use case:** Collect comprehensive diagnostic information

```json
{
  "type": "form",
  "id": "issue-report-form",
  "data": {
    "title": "Report an Issue",
    "description": "Provide details about the problem",
    "fields": [
      {
        "name": "issue_type",
        "label": "Issue Type",
        "type": "select",
        "required": true,
        "placeholder": "Select type",
        "options": [
          {"value": "hardware", "label": "Hardware"},
          {"value": "software", "label": "Software"}
        ]
      },
      {
        "name": "description",
        "label": "Description",
        "type": "textarea",
        "required": true,
        "placeholder": "Describe the issue in detail...",
        "maxLength": 500
      },
      {
        "name": "error_code",
        "label": "Error Code (if any)",
        "type": "text",
        "required": false,
        "placeholder": "E.g., E42-7"
      }
    ],
    "submitLabel": "Submit Report"
  }
}
```

**Fields:**
- `title`: Form title
- `description`: Form description
- `fields`: Array of form field objects
  - `name`: Field identifier
  - `label`: Field label
  - `type`: "text" | "textarea" | "select" | "number"
  - `required`: Whether field is required
  - `placeholder`: Placeholder text
  - `options`: For select fields only
  - `maxLength`: For text/textarea fields
- `submitLabel`: Submit button text

### 9. Code Block
**Use case:** Display terminal commands or code snippets

```json
{
  "type": "code",
  "id": "terminal-commands",
  "data": {
    "code": "sudo systemctl restart arcade-service\njournalctl -u arcade-service -n 50",
    "language": "bash"
  }
}
```

**Fields:**
- `code`: Code content (use `\n` for line breaks)
- `language`: Optional syntax highlighting language

### 10. Action Button
**Use case:** Single action trigger

```json
{
  "type": "button",
  "id": "diagnostic-btn",
  "data": {
    "label": "Run Diagnostic Test",
    "icon": "⚡",
    "variant": "default",
    "size": "sm",
    "action": "run_diagnostic",
    "autoSendMessage": "Please run the power supply diagnostic test"
  }
}
```

**Fields:**
- `label`: Button text
- `icon`: Optional emoji/icon
- `variant`: "default" | "outline" | "secondary"
- `size`: "sm" | "default" | "lg"
- `action`: Action identifier
- `autoSendMessage`: Message sent on click

## Complete Response Example

Here's a complete AI response with multiple interactive components:

```json
{
  "summary": "Let's diagnose this power issue systematically. First, I need to understand what symptoms you're experiencing, then we'll run through some safety checks before testing.",
  "what": ["Power supply", "Main board connections", "Voltage regulation"],
  "how": [
    "Identify the specific symptom",
    "Complete safety checklist",
    "Measure voltages at test points"
  ],
  "why": [
    "Different symptoms point to different failure modes",
    "Safety prevents injury and equipment damage",
    "Voltage readings isolate the faulty component"
  ],
  "interactive_components": [
    {
      "type": "button_group",
      "id": "symptom-selector",
      "data": {
        "title": "What symptoms are you seeing?",
        "buttons": [
          {
            "label": "No Power",
            "variant": "outline",
            "autoSendMessage": "The machine has no power at all"
          },
          {
            "label": "Intermittent Power",
            "variant": "outline",
            "autoSendMessage": "Power comes and goes randomly"
          },
          {
            "label": "Powers On But Won't Boot",
            "variant": "outline",
            "autoSendMessage": "Power LED is on but system won't boot"
          }
        ]
      }
    },
    {
      "type": "checklist",
      "id": "safety-checks",
      "data": {
        "title": "Safety Checklist - Complete Before Testing",
        "items": [
          {"label": "Power disconnected from wall outlet", "checked": false},
          {"label": "Capacitors discharged (wait 5 minutes)", "checked": false},
          {"label": "ESD strap connected", "checked": false},
          {"label": "Work area clear and dry", "checked": false}
        ]
      }
    },
    {
      "type": "status",
      "id": "safety-warning",
      "data": {
        "icon": "⚠️",
        "status": "warning",
        "title": "High Voltage Warning",
        "message": "Power supplies contain lethal voltages even when unplugged. Always discharge capacitors and use proper safety equipment."
      }
    }
  ],
  "sources": [
    {
      "manual_id": "williams-system-11",
      "page": 42,
      "note": "Power supply voltage specifications and test points"
    }
  ]
}
```

## Viewing the Component Library

Users can click the **sparkle icon** (✨) in the chat interface to open the Interactive Component Library, which shows:
- Live previews of all components
- Complete JSON schemas
- Copy-to-clipboard functionality
- Use case descriptions

## Best Practices

### When to Use Interactive Components

**DO use when:**
- You need the user to choose between 2-5 specific options
- You're guiding through a multi-step procedure
- You need to collect specific data (error codes, measurements)
- You want to show progress or status visually
- You're presenting safety checklists

**DON'T use when:**
- The question is open-ended
- You need more than 5 options (use select instead)
- The user just needs information (no interaction needed)

### Component Selection Guide

| Scenario | Recommended Component |
|----------|---------------------|
| "Which symptom describes your issue?" | `button_group` |
| "What's the error code?" | `input` |
| "Follow these safety steps" | `checklist` |
| "Testing connections..." | `progress` |
| "Test passed/failed" | `status` |
| "Select your model" | `select` |
| "Rate the severity" | `slider` |
| "Tell me about the issue" | `form` |
| "Run this command" | `code` |

### UX Guidelines

1. **Keep it simple**: Don't overwhelm with too many components at once
2. **Be clear**: Button labels should be specific and actionable
3. **Provide context**: Always explain why you're asking before showing components
4. **Follow up**: After user interaction, acknowledge their input and proceed
5. **Safety first**: Use warning status indicators for dangerous procedures

## Testing Interactive Components

To test if your AI is generating components correctly:

1. Ask a question that should trigger components (e.g., "My machine won't power on")
2. Check the AI response includes `interactive_components` array
3. Verify components render correctly in the chat
4. Test user interactions (clicking buttons, filling forms)
5. Confirm autoSendMessage works when configured

## Troubleshooting

**Components not appearing:**
- Check that `interactive_components` is in the response JSON
- Verify the component `type` is spelled correctly
- Ensure all required `data` fields are present

**Components rendering but not working:**
- Check browser console for errors
- Verify `autoSendMessage` is set for interactive elements
- Ensure component IDs are unique

**AI not using components:**
- Verify system prompt includes interactive component instructions
- Check that the AI model supports structured output
- Review example prompts in the system message
