Modal overlay for focused tasks — assign a shift, confirm a publish action.

```jsx
<Dialog open={open} onClose={close} title="Publish this week's schedule?" footer={<><Button variant="ghost" onClick={close}>Cancel</Button><Button variant="primary">Publish</Button></>}>
  12 employees will be notified by push and text.
</Dialog>
```

Scrim is a flat dark-green tint (`rgba(10,20,17,0.4)`), no blur. Escape key
and scrim click both close.
