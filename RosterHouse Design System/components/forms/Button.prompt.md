Primary action control, used for schedule actions like "Publish schedule" or "Assign shift."

```jsx
<Button variant="primary" size="md" onClick={handlePublish}>
  Publish schedule
</Button>
```

Variants: `primary` (brand green, default), `secondary` (outlined), `ghost`
(text-only, for low-emphasis actions inside dense rows), `accent` (harvest
amber — reserve for one standout action per screen, e.g. "Claim shift"),
`danger` (destructive, e.g. "Delete shift").

Sizes: `sm` (dense toolbars/table rows), `md` (default), `lg` (primary
mobile CTAs). Pass `icon` for a leading Lucide icon element, `fullWidth` for
mobile bottom-sheet actions.
