Dropdown select for a small, closed set of options — role, location, shift status.

```jsx
<Select
  label="Role"
  value={role}
  onChange={setRole}
  options={[{ value: "cook", label: "Line cook" }, { value: "server", label: "Server" }]}
/>
```

Click-outside closes the menu. Selected option highlights with
`--surface-brand-soft`.
