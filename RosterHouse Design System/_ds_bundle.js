/* @ds-bundle: {"format":4,"namespace":"RosterHouseDesignSystem_17c92d","components":[{"name":"Card","sourcePath":"components/containers/Card.jsx"},{"name":"Dialog","sourcePath":"components/containers/Dialog.jsx"},{"name":"Tabs","sourcePath":"components/containers/Tabs.jsx"},{"name":"Badge","sourcePath":"components/feedback/Badge.jsx"},{"name":"Tag","sourcePath":"components/feedback/Tag.jsx"},{"name":"Toast","sourcePath":"components/feedback/Toast.jsx"},{"name":"Tooltip","sourcePath":"components/feedback/Tooltip.jsx"},{"name":"Button","sourcePath":"components/forms/Button.jsx"},{"name":"Checkbox","sourcePath":"components/forms/Checkbox.jsx"},{"name":"Input","sourcePath":"components/forms/Input.jsx"},{"name":"Select","sourcePath":"components/forms/Select.jsx"},{"name":"Switch","sourcePath":"components/forms/Switch.jsx"},{"name":"AvatarStatus","sourcePath":"components/scheduling/AvatarStatus.jsx"},{"name":"ConflictChip","sourcePath":"components/scheduling/ConflictChip.jsx"},{"name":"ShiftBlock","sourcePath":"components/scheduling/ShiftBlock.jsx"},{"name":"WeekGridCell","sourcePath":"components/scheduling/WeekGridCell.jsx"}],"sourceHashes":{"components/containers/Card.jsx":"b73994a7e949","components/containers/Dialog.jsx":"02c222c1ec8b","components/containers/Tabs.jsx":"7e5f6e5df2e5","components/feedback/Badge.jsx":"5604ab2db845","components/feedback/Tag.jsx":"b2a045df60bf","components/feedback/Toast.jsx":"ca752d23672f","components/feedback/Tooltip.jsx":"e7cfd76f572a","components/forms/Button.jsx":"50c2c95d39f7","components/forms/Checkbox.jsx":"e62c740d9290","components/forms/Input.jsx":"04f2c6527a46","components/forms/Select.jsx":"6d6858c4faab","components/forms/Switch.jsx":"a81b8fe57854","components/scheduling/AvatarStatus.jsx":"10d1942d20c9","components/scheduling/ConflictChip.jsx":"2bc627b15cd3","components/scheduling/ShiftBlock.jsx":"869d5f1895be","components/scheduling/WeekGridCell.jsx":"b274292cafc4","ui_kits/employee-mobile/EmployeeApp.jsx":"61441e971033","ui_kits/manager-web/AssignShiftDialog.jsx":"fabc8f4efc0d","ui_kits/manager-web/AvailabilityOverview.jsx":"ffb281b6cd4a","ui_kits/manager-web/DashboardScreen.jsx":"7f27ad01973c","ui_kits/manager-web/ManagerApp.jsx":"ef4a230a8cef","ui_kits/manager-web/ScheduleView.jsx":"9d3c5230e255","ui_kits/manager-web/Sidebar.jsx":"4832520c903e","ui_kits/manager-web/SwapApprovals.jsx":"a078c22af9ac","ui_kits/manager-web/WeekGrid.jsx":"d7e474aa8e8c"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.RosterHouseDesignSystem_17c92d = window.RosterHouseDesignSystem_17c92d || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/containers/Card.jsx
try { (() => {
/**
 * Card — surface container for grouped content.
 */
function Card({
  children,
  padding = "var(--space-6)",
  hoverable = false,
  style = {}
}) {
  const [hover, setHover] = React.useState(false);
  return /*#__PURE__*/React.createElement("div", {
    onMouseEnter: () => hoverable && setHover(true),
    onMouseLeave: () => hoverable && setHover(false),
    style: {
      background: "var(--surface-card)",
      border: "1px solid var(--border-default)",
      borderRadius: "var(--radius-lg)",
      padding,
      boxShadow: hover ? "var(--shadow-md)" : "var(--shadow-sm)",
      transition: "box-shadow var(--duration-base) var(--ease-out)",
      fontFamily: "var(--font-sans)",
      ...style
    }
  }, children);
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/containers/Card.jsx", error: String((e && e.message) || e) }); }

// components/containers/Dialog.jsx
try { (() => {
const {
  useEffect
} = React;
/**
 * Dialog — modal overlay for focused tasks (assign shift, confirm publish).
 */
function Dialog({
  open,
  onClose,
  title,
  children,
  footer
}) {
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose && onClose();
    }
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return /*#__PURE__*/React.createElement("div", {
    onClick: onClose,
    style: {
      position: "fixed",
      inset: 0,
      background: "rgba(10, 20, 17, 0.4)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 100,
      fontFamily: "var(--font-sans)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: e => e.stopPropagation(),
    style: {
      width: 420,
      maxWidth: "90vw",
      background: "var(--surface-card)",
      borderRadius: "var(--radius-xl)",
      boxShadow: "var(--shadow-lg)",
      padding: "var(--space-7)",
      display: "flex",
      flexDirection: "column",
      gap: "var(--space-5)"
    }
  }, title && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "var(--text-h2-size)",
      fontWeight: "var(--text-h2-weight)",
      color: "var(--text-primary)"
    }
  }, title), /*#__PURE__*/React.createElement("div", {
    style: {
      color: "var(--text-primary)",
      fontSize: "var(--text-body-size)"
    }
  }, children), footer && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "flex-end",
      gap: 10
    }
  }, footer)));
}
Object.assign(__ds_scope, { Dialog });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/containers/Dialog.jsx", error: String((e && e.message) || e) }); }

// components/containers/Tabs.jsx
try { (() => {
const {
  useState
} = React;
/**
 * Tabs — segmented navigation between views (e.g. Schedule / Availability / Time off).
 */
function Tabs({
  tabs = [],
  value,
  defaultValue,
  onChange
}) {
  const [internal, setInternal] = useState(defaultValue || tabs[0] && tabs[0].value);
  const active = value !== undefined ? value : internal;
  function select(v) {
    if (value === undefined) setInternal(v);
    onChange && onChange(v);
  }
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 4,
      background: "var(--surface-sunken)",
      padding: 4,
      borderRadius: "var(--radius-md)",
      fontFamily: "var(--font-sans)",
      width: "fit-content"
    }
  }, tabs.map(t => /*#__PURE__*/React.createElement("div", {
    key: t.value,
    onClick: () => select(t.value),
    style: {
      padding: "8px 16px",
      borderRadius: "var(--radius-sm)",
      fontSize: "var(--text-label-size)",
      fontWeight: 600,
      color: active === t.value ? "var(--text-brand)" : "var(--text-secondary)",
      background: active === t.value ? "var(--surface-card)" : "transparent",
      boxShadow: active === t.value ? "var(--shadow-sm)" : "none",
      cursor: "pointer",
      transition: "background var(--duration-base) var(--ease-out)"
    }
  }, t.label)));
}
Object.assign(__ds_scope, { Tabs });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/containers/Tabs.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Badge.jsx
try { (() => {
/**
 * Badge — small status/count indicator, often on avatars or nav icons.
 */
function Badge({
  tone = "success",
  children
}) {
  const tones = {
    success: {
      bg: "var(--status-success-bg)",
      fg: "var(--status-success)"
    },
    warning: {
      bg: "var(--status-warning-bg)",
      fg: "var(--amber-800)"
    },
    danger: {
      bg: "var(--status-danger-bg)",
      fg: "var(--status-danger)"
    },
    info: {
      bg: "var(--status-info-bg)",
      fg: "var(--status-info)"
    },
    neutral: {
      bg: "var(--surface-sunken)",
      fg: "var(--text-secondary)"
    }
  }[tone];
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 4,
      padding: "3px 10px",
      borderRadius: "var(--radius-pill)",
      fontFamily: "var(--font-sans)",
      fontSize: "var(--text-caption-size)",
      fontWeight: "var(--text-caption-weight)",
      letterSpacing: "var(--text-caption-tracking)",
      textTransform: "uppercase",
      background: tones.bg,
      color: tones.fg
    }
  }, children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Badge.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Tag.jsx
try { (() => {
/**
 * Tag — removable label chip, used for roles/skills/filters.
 */
function Tag({
  children,
  onRemove,
  color = "neutral"
}) {
  const colors = {
    neutral: {
      bg: "var(--surface-sunken)",
      fg: "var(--text-primary)"
    },
    brand: {
      bg: "var(--surface-brand-soft)",
      fg: "var(--text-brand)"
    },
    accent: {
      bg: "var(--amber-100)",
      fg: "var(--amber-800)"
    }
  }[color];
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      padding: "5px 10px",
      borderRadius: "var(--radius-sm)",
      fontFamily: "var(--font-sans)",
      fontSize: "var(--text-body-sm-size)",
      fontWeight: 500,
      background: colors.bg,
      color: colors.fg
    }
  }, children, onRemove && /*#__PURE__*/React.createElement("span", {
    onClick: onRemove,
    style: {
      cursor: "pointer",
      opacity: 0.6,
      fontWeight: 700
    }
  }, "\xD7"));
}
Object.assign(__ds_scope, { Tag });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Tag.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Toast.jsx
try { (() => {
/**
 * Toast — transient notification banner (schedule published, shift updated).
 */
function Toast({
  tone = "success",
  title,
  description,
  onClose
}) {
  const tones = {
    success: {
      icon: "var(--status-success)",
      iconBg: "var(--status-success-bg)"
    },
    warning: {
      icon: "var(--amber-700)",
      iconBg: "var(--status-warning-bg)"
    },
    danger: {
      icon: "var(--status-danger)",
      iconBg: "var(--status-danger-bg)"
    },
    info: {
      icon: "var(--status-info)",
      iconBg: "var(--status-info-bg)"
    }
  }[tone];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "flex-start",
      gap: 12,
      width: 320,
      padding: "14px 16px",
      background: "var(--surface-card)",
      border: "1px solid var(--border-default)",
      borderRadius: "var(--radius-lg)",
      boxShadow: "var(--shadow-lg)",
      fontFamily: "var(--font-sans)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      flex: "none",
      width: 28,
      height: 28,
      borderRadius: "50%",
      background: tones.iconBg,
      color: tones.icon,
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "15",
    height: "15",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2.5",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("polyline", {
    points: "20 6 9 17 4 12"
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "var(--text-h3-size)",
      fontWeight: 600,
      color: "var(--text-primary)"
    }
  }, title), description && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "var(--text-body-sm-size)",
      color: "var(--text-secondary)",
      marginTop: 4
    }
  }, description)), onClose && /*#__PURE__*/React.createElement("span", {
    onClick: onClose,
    style: {
      cursor: "pointer",
      color: "var(--text-tertiary)",
      fontSize: 16,
      lineHeight: 1
    }
  }, "\xD7"));
}
Object.assign(__ds_scope, { Toast });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Toast.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Tooltip.jsx
try { (() => {
const {
  useState
} = React;
/**
 * Tooltip — small hover label for icon-only controls.
 */
function Tooltip({
  label,
  children,
  side = "top"
}) {
  const [show, setShow] = useState(false);
  const pos = {
    top: {
      bottom: "calc(100% + 6px)",
      left: "50%",
      transform: "translateX(-50%)"
    },
    bottom: {
      top: "calc(100% + 6px)",
      left: "50%",
      transform: "translateX(-50%)"
    }
  }[side];
  return /*#__PURE__*/React.createElement("span", {
    style: {
      position: "relative",
      display: "inline-flex"
    },
    onMouseEnter: () => setShow(true),
    onMouseLeave: () => setShow(false)
  }, children, show && /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      ...pos,
      whiteSpace: "nowrap",
      background: "var(--green-900)",
      color: "var(--text-inverse)",
      fontFamily: "var(--font-sans)",
      fontSize: "var(--text-body-sm-size)",
      padding: "6px 10px",
      borderRadius: "var(--radius-sm)",
      boxShadow: "var(--shadow-md)",
      zIndex: 20
    }
  }, label));
}
Object.assign(__ds_scope, { Tooltip });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Tooltip.jsx", error: String((e && e.message) || e) }); }

// components/forms/Button.jsx
try { (() => {
const {
  useState
} = React;
/**
 * Button — primary UI action control.
 * Variants: primary (brand green), secondary (outlined), ghost (text-only),
 * accent (amber, sparing use), danger (destructive).
 */
function Button({
  variant = "primary",
  size = "md",
  disabled = false,
  icon = null,
  fullWidth = false,
  children,
  onClick,
  type = "button"
}) {
  const [state, setState] = useState("rest"); // rest | hover | active

  const sizes = {
    sm: {
      padding: "6px 12px",
      fontSize: 13,
      gap: 6,
      radius: "var(--radius-sm)"
    },
    md: {
      padding: "10px 18px",
      fontSize: 14,
      gap: 8,
      radius: "var(--radius-md)"
    },
    lg: {
      padding: "13px 22px",
      fontSize: 16,
      gap: 8,
      radius: "var(--radius-md)"
    }
  }[size];
  const palettes = {
    primary: {
      rest: {
        bg: "var(--accent-primary)",
        fg: "var(--accent-contrast)",
        border: "transparent"
      },
      hover: {
        bg: "var(--accent-hover)",
        fg: "var(--accent-contrast)",
        border: "transparent"
      },
      active: {
        bg: "var(--accent-active)",
        fg: "var(--accent-contrast)",
        border: "transparent"
      }
    },
    secondary: {
      rest: {
        bg: "var(--surface-card)",
        fg: "var(--text-brand)",
        border: "var(--border-strong)"
      },
      hover: {
        bg: "var(--surface-brand-soft)",
        fg: "var(--text-brand)",
        border: "var(--border-brand)"
      },
      active: {
        bg: "var(--green-100)",
        fg: "var(--text-brand)",
        border: "var(--border-brand)"
      }
    },
    ghost: {
      rest: {
        bg: "transparent",
        fg: "var(--text-brand)",
        border: "transparent"
      },
      hover: {
        bg: "var(--surface-brand-soft)",
        fg: "var(--text-brand)",
        border: "transparent"
      },
      active: {
        bg: "var(--green-100)",
        fg: "var(--text-brand)",
        border: "transparent"
      }
    },
    accent: {
      rest: {
        bg: "var(--accent-secondary)",
        fg: "var(--green-900)",
        border: "transparent"
      },
      hover: {
        bg: "var(--accent-secondary-hover)",
        fg: "var(--green-900)",
        border: "transparent"
      },
      active: {
        bg: "var(--accent-secondary-active)",
        fg: "var(--green-900)",
        border: "transparent"
      }
    },
    danger: {
      rest: {
        bg: "var(--status-danger)",
        fg: "#fff",
        border: "transparent"
      },
      hover: {
        bg: "var(--red-700)",
        fg: "#fff",
        border: "transparent"
      },
      active: {
        bg: "var(--red-700)",
        fg: "#fff",
        border: "transparent"
      }
    }
  }[variant];
  const p = disabled ? palettes.rest : palettes[state];
  return /*#__PURE__*/React.createElement("button", {
    type: type,
    disabled: disabled,
    onClick: onClick,
    onMouseEnter: () => setState("hover"),
    onMouseLeave: () => setState("rest"),
    onMouseDown: () => setState("active"),
    onMouseUp: () => setState("hover"),
    style: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      gap: sizes.gap,
      whiteSpace: "nowrap",
      flexShrink: 0,
      width: fullWidth ? "100%" : "auto",
      padding: sizes.padding,
      fontFamily: "var(--font-sans)",
      fontSize: sizes.fontSize,
      fontWeight: 600,
      lineHeight: 1,
      color: p.fg,
      background: p.bg,
      border: `1.5px solid ${p.border}`,
      borderRadius: sizes.radius,
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.5 : 1,
      transform: !disabled && state === "active" ? "translateY(1px)" : "translateY(0)",
      transition: `background var(--duration-base) var(--ease-out), border-color var(--duration-base) var(--ease-out), transform var(--duration-fast) var(--ease-standard)`
    }
  }, icon, children);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Button.jsx", error: String((e && e.message) || e) }); }

// components/forms/Checkbox.jsx
try { (() => {
/**
 * Checkbox — binary selection control.
 */
function Checkbox({
  label,
  checked = false,
  onChange,
  disabled = false
}) {
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      fontFamily: "var(--font-sans)",
      fontSize: "var(--text-body-size)",
      color: disabled ? "var(--text-tertiary)" : "var(--text-primary)",
      cursor: disabled ? "not-allowed" : "pointer"
    }
  }, /*#__PURE__*/React.createElement("span", {
    onClick: () => !disabled && onChange && onChange(!checked),
    style: {
      width: 20,
      height: 20,
      flex: "none",
      borderRadius: "var(--radius-sm)",
      border: `1.5px solid ${checked ? "var(--accent-primary)" : "var(--border-strong)"}`,
      background: checked ? "var(--accent-primary)" : "var(--surface-card)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      transition: "background var(--duration-fast) var(--ease-out), border-color var(--duration-fast) var(--ease-out)",
      opacity: disabled ? 0.5 : 1
    }
  }, checked && /*#__PURE__*/React.createElement("svg", {
    width: "12",
    height: "12",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "white",
    strokeWidth: "3",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("polyline", {
    points: "20 6 9 17 4 12"
  }))), label);
}
Object.assign(__ds_scope, { Checkbox });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Checkbox.jsx", error: String((e && e.message) || e) }); }

// components/forms/Input.jsx
try { (() => {
const {
  useState
} = React;
/**
 * Input — single-line text field.
 */
function Input({
  label,
  placeholder,
  value,
  onChange,
  type = "text",
  error,
  disabled = false,
  icon = null
}) {
  const [focused, setFocused] = useState(false);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 6,
      fontFamily: "var(--font-sans)",
      minWidth: 0
    }
  }, label && /*#__PURE__*/React.createElement("label", {
    style: {
      fontSize: "var(--text-label-size)",
      fontWeight: "var(--text-label-weight)",
      color: "var(--text-primary)"
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: "0 12px",
      height: 44,
      width: "100%",
      boxSizing: "border-box",
      background: disabled ? "var(--surface-sunken)" : "var(--surface-card)",
      border: `1.5px solid ${error ? "var(--status-danger)" : focused ? "var(--border-focus)" : "var(--border-default)"}`,
      borderRadius: "var(--radius-md)",
      boxShadow: focused ? "var(--shadow-focus)" : "none",
      transition: "box-shadow var(--duration-base) var(--ease-out), border-color var(--duration-base) var(--ease-out)"
    }
  }, icon, /*#__PURE__*/React.createElement("input", {
    type: type,
    value: value,
    placeholder: placeholder,
    disabled: disabled,
    onChange: onChange,
    onFocus: () => setFocused(true),
    onBlur: () => setFocused(false),
    style: {
      flex: 1,
      minWidth: 0,
      border: "none",
      outline: "none",
      background: "transparent",
      fontFamily: "var(--font-sans)",
      fontSize: "var(--text-body-size)",
      color: "var(--text-primary)"
    }
  })), error && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "var(--text-body-sm-size)",
      color: "var(--status-danger)"
    }
  }, error));
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Input.jsx", error: String((e && e.message) || e) }); }

// components/forms/Select.jsx
try { (() => {
const {
  useState,
  useRef,
  useEffect
} = React;
/**
 * Select — dropdown for a small set of options (role, location, status).
 */
function Select({
  label,
  value,
  onChange,
  options = [],
  placeholder = "Select…"
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    function onDoc(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);
  const current = options.find(o => o.value === value);
  return /*#__PURE__*/React.createElement("div", {
    ref: ref,
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 6,
      fontFamily: "var(--font-sans)",
      position: "relative"
    }
  }, label && /*#__PURE__*/React.createElement("label", {
    style: {
      fontSize: "var(--text-label-size)",
      fontWeight: "var(--text-label-weight)",
      color: "var(--text-primary)"
    }
  }, label), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => setOpen(o => !o),
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      height: 44,
      padding: "0 12px",
      background: "var(--surface-card)",
      border: `1.5px solid ${open ? "var(--border-focus)" : "var(--border-default)"}`,
      borderRadius: "var(--radius-md)",
      boxShadow: open ? "var(--shadow-focus)" : "none",
      fontFamily: "var(--font-sans)",
      fontSize: "var(--text-body-size)",
      color: current ? "var(--text-primary)" : "var(--text-tertiary)",
      cursor: "pointer"
    }
  }, current ? current.label : placeholder, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      color: "var(--text-tertiary)"
    }
  }, "\u25BE")), open && /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      top: "100%",
      left: 0,
      right: 0,
      marginTop: 4,
      background: "var(--surface-card)",
      border: "1px solid var(--border-default)",
      borderRadius: "var(--radius-md)",
      boxShadow: "var(--shadow-lg)",
      zIndex: 10,
      overflow: "hidden"
    }
  }, options.map(o => /*#__PURE__*/React.createElement("div", {
    key: o.value,
    onClick: () => {
      onChange && onChange(o.value);
      setOpen(false);
    },
    style: {
      padding: "10px 12px",
      fontSize: "var(--text-body-size)",
      color: "var(--text-primary)",
      background: o.value === value ? "var(--surface-brand-soft)" : "transparent",
      cursor: "pointer"
    },
    onMouseEnter: e => e.currentTarget.style.background = "var(--surface-sunken)",
    onMouseLeave: e => e.currentTarget.style.background = o.value === value ? "var(--surface-brand-soft)" : "transparent"
  }, o.label))));
}
Object.assign(__ds_scope, { Select });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Select.jsx", error: String((e && e.message) || e) }); }

// components/forms/Switch.jsx
try { (() => {
/**
 * Switch — on/off toggle, used for settings & notification preferences.
 */
function Switch({
  label,
  checked = false,
  onChange,
  disabled = false
}) {
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      fontFamily: "var(--font-sans)",
      fontSize: "var(--text-body-size)",
      color: "var(--text-primary)",
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.5 : 1
    }
  }, label && /*#__PURE__*/React.createElement("span", null, label), /*#__PURE__*/React.createElement("span", {
    onClick: () => !disabled && onChange && onChange(!checked),
    style: {
      width: 40,
      height: 24,
      flex: "none",
      borderRadius: "var(--radius-pill)",
      background: checked ? "var(--accent-primary)" : "var(--neutral-300)",
      position: "relative",
      transition: "background var(--duration-base) var(--ease-out)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      top: 3,
      left: checked ? 19 : 3,
      width: 18,
      height: 18,
      borderRadius: "50%",
      background: "#fff",
      boxShadow: "var(--shadow-sm)",
      transition: "left var(--duration-base) var(--ease-out)"
    }
  })));
}
Object.assign(__ds_scope, { Switch });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Switch.jsx", error: String((e && e.message) || e) }); }

// components/scheduling/AvatarStatus.jsx
try { (() => {
/**
 * AvatarStatus — employee avatar (initials) with an availability/status dot.
 */
function AvatarStatus({
  name,
  status = "available",
  size = 40
}) {
  const initials = name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase();
  const dotColor = {
    available: "var(--status-success)",
    unavailable: "var(--status-danger)",
    pending: "var(--status-warning)",
    off: "var(--neutral-400)"
  }[status];
  return /*#__PURE__*/React.createElement("span", {
    style: {
      position: "relative",
      display: "inline-flex",
      fontFamily: "var(--font-sans)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: size,
      height: size,
      borderRadius: "50%",
      background: "var(--green-100)",
      color: "var(--green-800)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontWeight: 700,
      fontSize: size * 0.38
    }
  }, initials), /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      bottom: 0,
      right: 0,
      width: size * 0.28,
      height: size * 0.28,
      borderRadius: "50%",
      background: dotColor,
      border: "2px solid var(--surface-card)"
    }
  }));
}
Object.assign(__ds_scope, { AvatarStatus });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/scheduling/AvatarStatus.jsx", error: String((e && e.message) || e) }); }

// components/scheduling/ConflictChip.jsx
try { (() => {
/**
 * ConflictChip — inline warning for scheduling conflicts.
 */
function ConflictChip({
  children
}) {
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      padding: "4px 10px",
      borderRadius: "var(--radius-sm)",
      background: "var(--status-danger-bg)",
      color: "var(--status-danger)",
      fontFamily: "var(--font-sans)",
      fontSize: "var(--text-body-sm-size)",
      fontWeight: 600
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "14",
    height: "14",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2.2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "12",
    y1: "9",
    x2: "12",
    y2: "13"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "12",
    y1: "17",
    x2: "12.01",
    y2: "17"
  })), children);
}
Object.assign(__ds_scope, { ConflictChip });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/scheduling/ConflictChip.jsx", error: String((e && e.message) || e) }); }

// components/scheduling/ShiftBlock.jsx
try { (() => {
/**
 * ShiftBlock — a scheduled shift as it appears on the week grid or a list.
 */
function ShiftBlock({
  role,
  time,
  employeeName,
  status = "confirmed",
  compact = false,
  conflictReason,
  onClick
}) {
  const palettes = {
    confirmed: {
      bg: "var(--green-50)",
      border: "var(--green-300)",
      fg: "var(--green-800)"
    },
    open: {
      bg: "var(--amber-50)",
      border: "var(--amber-300)",
      fg: "var(--amber-800)"
    },
    conflict: {
      bg: "var(--red-50)",
      border: "var(--red-500)",
      fg: "var(--red-700)"
    },
    draft: {
      bg: "var(--surface-sunken)",
      border: "var(--border-strong)",
      fg: "var(--text-secondary)"
    }
  }[status];
  return /*#__PURE__*/React.createElement("div", {
    onClick: onClick,
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 2,
      width: "100%",
      boxSizing: "border-box",
      padding: compact ? "6px 8px" : "10px 12px",
      background: palettes.bg,
      border: `1.5px solid ${palettes.border}`,
      borderRadius: "var(--radius-md)",
      cursor: onClick ? "pointer" : "default",
      fontFamily: "var(--font-sans)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: compact ? 11 : "var(--text-label-size)",
      fontWeight: 600,
      color: palettes.fg
    }
  }, role), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: compact ? 10 : "var(--text-body-sm-size)",
      color: "var(--text-secondary)"
    }
  }, time), employeeName && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: compact ? 10 : "var(--text-body-sm-size)",
      color: "var(--text-primary)",
      fontWeight: 500
    }
  }, employeeName), status === "conflict" && conflictReason && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "flex-start",
      gap: 4,
      marginTop: 3,
      paddingTop: 3,
      borderTop: "1px solid var(--red-100)",
      fontSize: compact ? 9.5 : 11,
      lineHeight: 1.3,
      fontWeight: 600,
      color: "var(--status-danger)"
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: compact ? "9" : "11",
    height: compact ? "9" : "11",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2.5",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    style: {
      flex: "none",
      marginTop: 2
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "12",
    y1: "9",
    x2: "12",
    y2: "13"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "12",
    y1: "17",
    x2: "12.01",
    y2: "17"
  })), conflictReason));
}
Object.assign(__ds_scope, { ShiftBlock });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/scheduling/ShiftBlock.jsx", error: String((e && e.message) || e) }); }

// components/scheduling/WeekGridCell.jsx
try { (() => {
/**
 * WeekGridCell — a single day/time cell in the manager's schedule grid.
 */
function WeekGridCell({
  children,
  empty = false,
  hasConflict = false,
  onClick
}) {
  const [hover, setHover] = React.useState(false);
  return /*#__PURE__*/React.createElement("div", {
    onClick: onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      minHeight: 72,
      padding: 6,
      display: "flex",
      flexDirection: "column",
      gap: 4,
      borderRadius: "var(--radius-sm)",
      border: hasConflict ? "1.5px dashed var(--status-danger)" : empty ? "1px solid var(--border-default)" : "none",
      background: empty ? hover ? "var(--surface-brand-soft)" : "var(--surface-card)" : "transparent",
      cursor: empty ? "pointer" : "default",
      transition: "background var(--duration-fast) var(--ease-out)",
      fontFamily: "var(--font-sans)"
    }
  }, empty && !children ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 18,
      color: hover ? "var(--text-brand)" : "var(--border-strong)",
      textAlign: "center"
    }
  }, "+") : children);
}
Object.assign(__ds_scope, { WeekGridCell });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/scheduling/WeekGridCell.jsx", error: String((e && e.message) || e) }); }

// ui_kits/employee-mobile/EmployeeApp.jsx
try { (() => {
(function () {
  const {
    useState
  } = React;
  const {
    Button,
    Badge,
    Card,
    Switch,
    Dialog,
    ConflictChip,
    Tag,
    Input,
    Tabs,
    Select
  } = window.RosterHouseDesignSystem_17c92d;
  const MY_SHIFTS = [{
    role: "Line cook",
    time: "7:00 AM – 3:00 PM",
    day: "Today · Tue Jul 7",
    location: "Downtown location",
    status: "confirmed",
    coworkers: ["Sam Torres", "Alex Kim"],
    notes: "Bring your own knife kit."
  }, {
    role: "Line cook",
    time: "7:00 AM – 3:00 PM",
    day: "Wed Jul 8",
    location: "Downtown location",
    status: "confirmed",
    coworkers: ["Priya Shah"],
    notes: ""
  }, {
    role: "Line cook",
    time: "2:00 PM – 8:00 PM",
    day: "Fri Jul 10",
    location: "Downtown location",
    status: "confirmed",
    coworkers: ["Jordan Park", "Sam Torres"],
    notes: "Inventory count at close."
  }];
  const OPEN_SHIFTS = [{
    role: "Server",
    time: "4:00 PM – 10:00 PM",
    day: "Sat Jul 12"
  }, {
    role: "Dishwasher",
    time: "6:00 PM – 12:00 AM",
    day: "Sun Jul 13"
  }];
  const NOTIFICATIONS = [{
    title: "Schedule published",
    body: "Your manager published next week's schedule.",
    tone: "success",
    when: "2h ago"
  }, {
    title: "Shift reminder",
    body: "Your Line cook shift starts at 7:00 AM tomorrow.",
    tone: "info",
    when: "1d ago"
  }, {
    title: "Swap request approved",
    body: "Sam Torres will cover your Fri shift.",
    tone: "success",
    when: "2d ago"
  }];
  const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  function TopBar({
    title,
    onBack,
    onBell
  }) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "18px 20px 8px"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 10
      }
    }, onBack && /*#__PURE__*/React.createElement("i", {
      onClick: onBack,
      "data-lucide": "chevron-left",
      style: {
        width: 22,
        height: 22,
        color: "var(--text-primary)",
        cursor: "pointer"
      }
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: "var(--text-h1-size)",
        fontWeight: "var(--text-h1-weight)",
        color: "var(--text-primary)",
        fontFamily: "var(--font-sans)"
      }
    }, title)), onBell && /*#__PURE__*/React.createElement("i", {
      onClick: onBell,
      "data-lucide": "bell",
      style: {
        width: 22,
        height: 22,
        color: "var(--text-primary)",
        cursor: "pointer"
      }
    }));
  }
  function LoginScreen({
    onLogin,
    onGoInvite
  }) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 18,
        padding: "72px 24px 24px",
        height: "100%",
        boxSizing: "border-box"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 26,
        fontWeight: 800,
        color: "var(--text-brand)",
        fontFamily: "var(--font-sans)"
      }
    }, "RosterHouse"), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: "var(--text-h2-size)",
        fontWeight: 700,
        color: "var(--text-primary)",
        fontFamily: "var(--font-sans)",
        marginTop: 12
      }
    }, "Log in"), /*#__PURE__*/React.createElement(Input, {
      label: "Phone or email",
      placeholder: "maria@example.com"
    }), /*#__PURE__*/React.createElement(Input, {
      label: "Password",
      type: "password",
      placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"
    }), /*#__PURE__*/React.createElement(Button, {
      variant: "primary",
      fullWidth: true,
      size: "lg",
      onClick: onLogin
    }, "Log in"), /*#__PURE__*/React.createElement("div", {
      style: {
        textAlign: "center",
        fontSize: 13,
        color: "var(--text-secondary)",
        fontFamily: "var(--font-sans)"
      }
    }, "Forgot password?"), /*#__PURE__*/React.createElement("div", {
      onClick: onGoInvite,
      style: {
        marginTop: "auto",
        textAlign: "center",
        fontSize: 14,
        color: "var(--text-brand)",
        fontWeight: 600,
        fontFamily: "var(--font-sans)",
        cursor: "pointer"
      }
    }, "New here? Accept your invite"));
  }
  function AcceptInviteScreen({
    onJoin,
    onBack
  }) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 16,
        padding: "0 24px 24px",
        height: "100%",
        boxSizing: "border-box"
      }
    }, /*#__PURE__*/React.createElement(TopBar, {
      title: "Accept invite",
      onBack: onBack
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 14,
        color: "var(--text-secondary)",
        fontFamily: "var(--font-sans)"
      }
    }, "Jamie Park invited you to join ", /*#__PURE__*/React.createElement("strong", {
      style: {
        color: "var(--text-primary)"
      }
    }, "Downtown location"), " on RosterHouse."), /*#__PURE__*/React.createElement(Input, {
      label: "Full name",
      placeholder: "Maria Garcia"
    }), /*#__PURE__*/React.createElement(Input, {
      label: "Phone number",
      placeholder: "(555) 123-4567"
    }), /*#__PURE__*/React.createElement(Input, {
      label: "Create password",
      type: "password",
      placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"
    }), /*#__PURE__*/React.createElement(Button, {
      variant: "primary",
      fullWidth: true,
      size: "lg",
      onClick: onJoin,
      style: {
        marginTop: 8
      }
    }, "Join team"));
  }
  function HomeScreen({
    onOpenShift,
    onBell
  }) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 14,
        padding: "0 20px 20px"
      }
    }, /*#__PURE__*/React.createElement(TopBar, {
      title: "Hi, Maria",
      onBell: onBell
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        background: "var(--surface-brand)",
        color: "var(--text-inverse)",
        borderRadius: "var(--radius-xl)",
        padding: "var(--space-6)",
        fontFamily: "var(--font-sans)"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 17,
        fontWeight: 700
      }
    }, "You're all set for this week."), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13,
        color: "var(--green-200)",
        marginTop: 4
      }
    }, "3 shifts \xB7 24 hrs total")), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: "var(--text-h3-size)",
        fontWeight: 700,
        color: "var(--text-primary)",
        fontFamily: "var(--font-sans)",
        marginTop: 6
      }
    }, "Upcoming shifts"), MY_SHIFTS.map((s, i) => /*#__PURE__*/React.createElement(Card, {
      key: i,
      hoverable: true,
      style: {
        cursor: "pointer"
      }
    }, /*#__PURE__*/React.createElement("div", {
      onClick: () => onOpenShift(s),
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between"
      }
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13,
        color: "var(--text-secondary)",
        fontFamily: "var(--font-sans)"
      }
    }, s.day), /*#__PURE__*/React.createElement("div", {
      style: {
        fontWeight: 700,
        color: "var(--text-primary)",
        fontFamily: "var(--font-sans)",
        marginTop: 2
      }
    }, s.role), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13,
        color: "var(--text-secondary)",
        fontFamily: "var(--font-sans)"
      }
    }, s.time)), /*#__PURE__*/React.createElement(Badge, {
      tone: "success"
    }, "Confirmed")))));
  }
  function ShiftDetailScreen({
    shift,
    onBack
  }) {
    if (!shift) return null;
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 16,
        padding: "0 20px 20px"
      }
    }, /*#__PURE__*/React.createElement(TopBar, {
      title: "Shift detail",
      onBack: onBack
    }), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: "var(--font-sans)"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13,
        color: "var(--text-secondary)"
      }
    }, shift.day), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: "var(--text-h2-size)",
        fontWeight: 700,
        color: "var(--text-primary)",
        marginTop: 2
      }
    }, shift.role), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 14,
        color: "var(--text-secondary)",
        marginTop: 2
      }
    }, shift.time), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 10
      }
    }, /*#__PURE__*/React.createElement(Badge, {
      tone: "success"
    }, "Confirmed")))), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 10,
        fontFamily: "var(--font-sans)"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 8,
        fontSize: 14,
        color: "var(--text-primary)"
      }
    }, /*#__PURE__*/React.createElement("i", {
      "data-lucide": "map-pin",
      style: {
        width: 16,
        height: 16,
        color: "var(--text-secondary)"
      }
    }), shift.location), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 8,
        fontSize: 14,
        color: "var(--text-primary)"
      }
    }, /*#__PURE__*/React.createElement("i", {
      "data-lucide": "users",
      style: {
        width: 16,
        height: 16,
        color: "var(--text-secondary)"
      }
    }), "With ", shift.coworkers.join(", ")))), shift.notes && /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: "var(--font-sans)"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13,
        fontWeight: 600,
        color: "var(--text-secondary)"
      }
    }, "Note from your manager"), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 14,
        color: "var(--text-primary)",
        marginTop: 4
      }
    }, shift.notes))), /*#__PURE__*/React.createElement(Button, {
      variant: "ghost",
      fullWidth: true
    }, "Request swap"));
  }
  const AVAILABILITY_PRESETS = [{
    key: "everyday",
    label: "Every day",
    days: {
      Mon: true,
      Tue: true,
      Wed: true,
      Thu: true,
      Fri: true,
      Sat: true,
      Sun: true
    }
  }, {
    key: "weekdays",
    label: "Weekdays only",
    days: {
      Mon: true,
      Tue: true,
      Wed: true,
      Thu: true,
      Fri: true,
      Sat: false,
      Sun: false
    }
  }, {
    key: "weekends",
    label: "Weekends only",
    days: {
      Mon: false,
      Tue: false,
      Wed: false,
      Thu: false,
      Fri: false,
      Sat: true,
      Sun: true
    }
  }];
  function AvailabilityScreen() {
    const [mode, setMode] = useState("simple"); // simple | advanced
    const [avail, setAvail] = useState({
      Mon: true,
      Tue: true,
      Wed: true,
      Thu: true,
      Fri: true,
      Sat: false,
      Sun: false
    });
    const [hours, setHours] = useState({
      Mon: {
        start: "9:00 AM",
        end: "5:00 PM"
      },
      Tue: {
        start: "9:00 AM",
        end: "5:00 PM"
      },
      Wed: {
        start: "9:00 AM",
        end: "5:00 PM"
      },
      Thu: {
        start: "9:00 AM",
        end: "5:00 PM"
      },
      Fri: {
        start: "9:00 AM",
        end: "5:00 PM"
      },
      Sat: {
        start: "9:00 AM",
        end: "5:00 PM"
      },
      Sun: {
        start: "9:00 AM",
        end: "5:00 PM"
      }
    });
    const [reqOpen, setReqOpen] = useState(false);
    const [reqStart, setReqStart] = useState("");
    const [reqEnd, setReqEnd] = useState("");
    const [reqReason, setReqReason] = useState("");
    const [reqNote, setReqNote] = useState("");
    function applyPreset(preset) {
      setAvail(preset.days);
    }
    function setHour(day, field, value) {
      setHours(h => ({
        ...h,
        [day]: {
          ...h[day],
          [field]: value
        }
      }));
    }
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 14,
        padding: "0 20px 20px"
      }
    }, /*#__PURE__*/React.createElement(TopBar, {
      title: "Availability"
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13,
        color: "var(--text-secondary)",
        fontFamily: "var(--font-sans)"
      }
    }, "Your weekly availability repeats every week until you change it."), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 8,
        flexWrap: "wrap"
      }
    }, AVAILABILITY_PRESETS.map(p => /*#__PURE__*/React.createElement(Button, {
      key: p.key,
      variant: "secondary",
      size: "sm",
      onClick: () => applyPreset(p)
    }, p.label))), /*#__PURE__*/React.createElement(Tabs, {
      tabs: [{
        value: "simple",
        label: "Simple"
      }, {
        value: "advanced",
        label: "Advanced"
      }],
      defaultValue: "simple",
      onChange: setMode
    }), mode === "simple" && /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 12
      }
    }, DAYS.map(d => /*#__PURE__*/React.createElement(Switch, {
      key: d,
      label: d,
      checked: avail[d],
      onChange: v => setAvail(a => ({
        ...a,
        [d]: v
      }))
    })))), mode === "advanced" && /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 16
      }
    }, DAYS.map(d => /*#__PURE__*/React.createElement("div", {
      key: d,
      style: {
        display: "flex",
        flexDirection: "column",
        gap: avail[d] ? 10 : 0
      }
    }, /*#__PURE__*/React.createElement(Switch, {
      label: d,
      checked: avail[d],
      onChange: v => setAvail(a => ({
        ...a,
        [d]: v
      }))
    }), avail[d] && /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 8,
        paddingLeft: 2
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1
      }
    }, /*#__PURE__*/React.createElement(Input, {
      placeholder: "9:00 AM",
      value: hours[d].start,
      onChange: e => setHour(d, "start", e.target.value)
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1
      }
    }, /*#__PURE__*/React.createElement(Input, {
      placeholder: "5:00 PM",
      value: hours[d].end,
      onChange: e => setHour(d, "end", e.target.value)
    }))))))), /*#__PURE__*/React.createElement(Button, {
      variant: "secondary",
      fullWidth: true,
      onClick: () => setReqOpen(true)
    }, "Request time off"), /*#__PURE__*/React.createElement(Dialog, {
      open: reqOpen,
      onClose: () => setReqOpen(false),
      title: "Request time off",
      footer: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Button, {
        variant: "ghost",
        onClick: () => setReqOpen(false)
      }, "Cancel"), /*#__PURE__*/React.createElement(Button, {
        variant: "primary",
        onClick: () => setReqOpen(false)
      }, "Send request"))
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 14
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 10
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1
      }
    }, /*#__PURE__*/React.createElement(Input, {
      label: "Start date",
      type: "date",
      value: reqStart,
      onChange: e => setReqStart(e.target.value)
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1
      }
    }, /*#__PURE__*/React.createElement(Input, {
      label: "End date",
      type: "date",
      value: reqEnd,
      onChange: e => setReqEnd(e.target.value)
    }))), /*#__PURE__*/React.createElement(Select, {
      label: "Reason",
      value: reqReason,
      onChange: setReqReason,
      placeholder: "Select a reason",
      options: [{
        value: "vacation",
        label: "Vacation"
      }, {
        value: "sick",
        label: "Sick"
      }, {
        value: "personal",
        label: "Personal"
      }, {
        value: "other",
        label: "Other"
      }]
    }), reqReason === "other" && /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 6
      }
    }, /*#__PURE__*/React.createElement("label", {
      style: {
        fontSize: "var(--text-label-size)",
        fontWeight: "var(--text-label-weight)",
        color: "var(--text-primary)"
      }
    }, "Tell your manager why"), /*#__PURE__*/React.createElement("textarea", {
      value: reqNote,
      onChange: e => setReqNote(e.target.value),
      placeholder: "e.g. Family emergency, moving day\u2026",
      rows: 3,
      style: {
        width: "100%",
        boxSizing: "border-box",
        padding: "10px 12px",
        background: "var(--surface-card)",
        border: "1.5px solid var(--border-default)",
        borderRadius: "var(--radius-md)",
        fontFamily: "var(--font-sans)",
        fontSize: "var(--text-body-size)",
        color: "var(--text-primary)",
        resize: "vertical",
        outline: "none"
      }
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13,
        color: "var(--text-secondary)"
      }
    }, "Your manager will review this request. You'll get a push notification once it's approved or denied."))));
  }
  function SwapScreen() {
    const [claimed, setClaimed] = useState({});
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 14,
        padding: "0 20px 20px"
      }
    }, /*#__PURE__*/React.createElement(TopBar, {
      title: "Open shifts"
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13,
        color: "var(--text-secondary)",
        fontFamily: "var(--font-sans)"
      }
    }, "Claim an open shift, or ask a teammate to cover one of yours."), OPEN_SHIFTS.map((s, i) => /*#__PURE__*/React.createElement(Card, {
      key: i
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between"
      }
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13,
        color: "var(--text-secondary)",
        fontFamily: "var(--font-sans)"
      }
    }, s.day), /*#__PURE__*/React.createElement("div", {
      style: {
        fontWeight: 700,
        color: "var(--text-primary)",
        fontFamily: "var(--font-sans)",
        marginTop: 2
      }
    }, s.role), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13,
        color: "var(--text-secondary)",
        fontFamily: "var(--font-sans)"
      }
    }, s.time)), /*#__PURE__*/React.createElement(Button, {
      variant: claimed[i] ? "secondary" : "accent",
      size: "sm",
      disabled: !!claimed[i],
      onClick: () => setClaimed(c => ({
        ...c,
        [i]: true
      }))
    }, claimed[i] ? "Claimed" : "Claim")))), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: "var(--text-h3-size)",
        fontWeight: 700,
        color: "var(--text-primary)",
        fontFamily: "var(--font-sans)",
        marginTop: 6
      }
    }, "My shifts"), MY_SHIFTS.slice(0, 2).map((s, i) => /*#__PURE__*/React.createElement(Card, {
      key: i
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between"
      }
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13,
        color: "var(--text-secondary)",
        fontFamily: "var(--font-sans)"
      }
    }, s.day), /*#__PURE__*/React.createElement("div", {
      style: {
        fontWeight: 700,
        color: "var(--text-primary)",
        fontFamily: "var(--font-sans)",
        marginTop: 2
      }
    }, s.role)), /*#__PURE__*/React.createElement(Button, {
      variant: "ghost",
      size: "sm"
    }, "Request swap")))));
  }
  function NotificationsScreen({
    onBack
  }) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 10,
        padding: "0 20px 20px"
      }
    }, /*#__PURE__*/React.createElement(TopBar, {
      title: "Notifications",
      onBack: onBack
    }), NOTIFICATIONS.map((n, i) => /*#__PURE__*/React.createElement(Card, {
      key: i
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        justifyContent: "space-between",
        gap: 10
      }
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      style: {
        fontWeight: 700,
        color: "var(--text-primary)",
        fontFamily: "var(--font-sans)"
      }
    }, n.title), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13,
        color: "var(--text-secondary)",
        fontFamily: "var(--font-sans)",
        marginTop: 2
      }
    }, n.body)), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 11,
        color: "var(--text-tertiary)",
        fontFamily: "var(--font-sans)",
        flex: "none"
      }
    }, n.when)))));
  }
  function TimeClockScreen() {
    const [clockedIn, setClockedIn] = useState(false);
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 16,
        padding: "0 20px 20px"
      }
    }, /*#__PURE__*/React.createElement(TopBar, {
      title: "Time clock"
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        gap: 16
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13,
        color: "var(--text-secondary)",
        fontFamily: "var(--font-sans)"
      }
    }, clockedIn ? "Clocked in for Line cook · Downtown location" : "You're not clocked in right now."), /*#__PURE__*/React.createElement("div", {
      onClick: () => setClockedIn(c => !c),
      style: {
        width: 180,
        height: 180,
        borderRadius: "50%",
        background: clockedIn ? "var(--status-danger-bg)" : "var(--surface-brand)",
        color: clockedIn ? "var(--status-danger)" : "var(--text-inverse)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: 6,
        margin: "20px 0",
        cursor: "pointer",
        fontFamily: "var(--font-sans)",
        fontWeight: 700,
        fontSize: 18,
        boxShadow: "var(--shadow-md)"
      }
    }, /*#__PURE__*/React.createElement("i", {
      "data-lucide": clockedIn ? "square" : "play",
      style: {
        width: 28,
        height: 28
      }
    }), clockedIn ? "Clock out" : "Clock in"), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 12,
        color: "var(--text-tertiary)",
        fontFamily: "var(--font-sans)"
      }
    }, "Uses your phone's location to confirm you're on-site.")));
  }
  function ProfileScreen() {
    const [push, setPush] = useState(true);
    const [sms, setSms] = useState(true);
    const [email, setEmail] = useState(false);
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 16,
        padding: "0 20px 20px"
      }
    }, /*#__PURE__*/React.createElement(TopBar, {
      title: "Profile"
    }), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 14,
        fontFamily: "var(--font-sans)"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: 52,
        height: 52,
        borderRadius: "50%",
        background: "var(--green-100)",
        color: "var(--green-800)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 700
      }
    }, "MG"), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      style: {
        fontWeight: 700,
        color: "var(--text-primary)"
      }
    }, "Maria Garcia"), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13,
        color: "var(--text-secondary)"
      }
    }, "Line cook \xB7 Downtown location")))), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: "var(--text-h3-size)",
        fontWeight: 700,
        color: "var(--text-primary)",
        fontFamily: "var(--font-sans)"
      }
    }, "Notification preferences"), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 14
      }
    }, /*#__PURE__*/React.createElement(Switch, {
      label: "Push notifications",
      checked: push,
      onChange: setPush
    }), /*#__PURE__*/React.createElement(Switch, {
      label: "Text messages (SMS)",
      checked: sms,
      onChange: setSms
    }), /*#__PURE__*/React.createElement(Switch, {
      label: "Email",
      checked: email,
      onChange: setEmail
    }))), /*#__PURE__*/React.createElement(Button, {
      variant: "ghost",
      fullWidth: true
    }, "Log out"));
  }
  const TABS = [{
    key: "home",
    label: "Shifts",
    icon: "calendar"
  }, {
    key: "availability",
    label: "Availability",
    icon: "calendar-check"
  }, {
    key: "clock",
    label: "Clock",
    icon: "timer"
  }, {
    key: "swap",
    label: "Open shifts",
    icon: "repeat"
  }, {
    key: "profile",
    label: "Profile",
    icon: "user"
  }];
  function PhoneShell({
    children
  }) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        width: 390,
        height: 844,
        background: "var(--surface-page)",
        borderRadius: 36,
        border: "8px solid var(--neutral-900)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        boxShadow: "var(--shadow-lg)"
      }
    }, children);
  }
  function EmployeeApp() {
    const [auth, setAuth] = useState("login"); // login | invite | app
    const [tab, setTab] = useState("home");
    const [push, setPush] = useState(null); // { type: 'shiftDetail'|'notifications', shift? }

    React.useEffect(() => {
      window.lucide && window.lucide.createIcons();
    });
    if (auth === "login") {
      return /*#__PURE__*/React.createElement(PhoneShell, null, /*#__PURE__*/React.createElement("div", {
        style: {
          flex: 1,
          overflow: "auto"
        }
      }, /*#__PURE__*/React.createElement(LoginScreen, {
        onLogin: () => setAuth("app"),
        onGoInvite: () => setAuth("invite")
      })));
    }
    if (auth === "invite") {
      return /*#__PURE__*/React.createElement(PhoneShell, null, /*#__PURE__*/React.createElement("div", {
        style: {
          flex: 1,
          overflow: "auto"
        }
      }, /*#__PURE__*/React.createElement(AcceptInviteScreen, {
        onJoin: () => setAuth("app"),
        onBack: () => setAuth("login")
      })));
    }
    return /*#__PURE__*/React.createElement(PhoneShell, null, /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        overflow: "auto"
      }
    }, push && push.type === "shiftDetail" && /*#__PURE__*/React.createElement(ShiftDetailScreen, {
      shift: push.shift,
      onBack: () => setPush(null)
    }), push && push.type === "notifications" && /*#__PURE__*/React.createElement(NotificationsScreen, {
      onBack: () => setPush(null)
    }), !push && tab === "home" && /*#__PURE__*/React.createElement(HomeScreen, {
      onOpenShift: s => setPush({
        type: "shiftDetail",
        shift: s
      }),
      onBell: () => setPush({
        type: "notifications"
      })
    }), !push && tab === "availability" && /*#__PURE__*/React.createElement(AvailabilityScreen, null), !push && tab === "clock" && /*#__PURE__*/React.createElement(TimeClockScreen, null), !push && tab === "swap" && /*#__PURE__*/React.createElement(SwapScreen, null), !push && tab === "profile" && /*#__PURE__*/React.createElement(ProfileScreen, null)), !push && /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        borderTop: "1px solid var(--border-default)",
        background: "var(--surface-card)",
        padding: "8px 4px 14px"
      }
    }, TABS.map(t => /*#__PURE__*/React.createElement("div", {
      key: t.key,
      onClick: () => setTab(t.key),
      style: {
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
        cursor: "pointer",
        color: tab === t.key ? "var(--text-brand)" : "var(--text-tertiary)",
        fontFamily: "var(--font-sans)",
        fontSize: 10.5,
        fontWeight: 600
      }
    }, /*#__PURE__*/React.createElement("i", {
      "data-lucide": t.icon,
      style: {
        width: 19,
        height: 19
      }
    }), t.label))));
  }
  window.__rh_employee = {
    EmployeeApp
  };
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/employee-mobile/EmployeeApp.jsx", error: String((e && e.message) || e) }); }

// ui_kits/manager-web/AssignShiftDialog.jsx
try { (() => {
(function () {
  const {
    Dialog,
    Select,
    Input,
    Button,
    ConflictChip
  } = window.RosterHouseDesignSystem_17c92d;
  const EMPLOYEES = ["Maria Garcia", "Sam Torres", "Jordan Park", "Alex Kim", "Priya Shah", "Diego Ramirez", "Chloe Nguyen", "Marcus Bell", "Taylor Osei", "Grace Lin"];
  function AssignShiftDialog({
    open,
    role,
    day,
    existing,
    onClose,
    onSave,
    onDelete
  }) {
    const [employee, setEmployee] = React.useState("");
    const [start, setStart] = React.useState("");
    const [end, setEnd] = React.useState("");
    React.useEffect(() => {
      if (open) {
        setEmployee(existing ? existing.employeeName || "" : "");
        setStart(existing ? existing.time.split(" – ")[0] : "");
        setEnd(existing ? existing.time.split(" – ")[1] : "");
      }
    }, [open, existing]);
    return /*#__PURE__*/React.createElement(Dialog, {
      open: open,
      onClose: onClose,
      title: existing ? "Edit shift" : "Assign shift",
      footer: /*#__PURE__*/React.createElement(React.Fragment, null, existing && /*#__PURE__*/React.createElement(Button, {
        variant: "ghost",
        onClick: onDelete
      }, "Remove"), /*#__PURE__*/React.createElement(Button, {
        variant: "ghost",
        onClick: onClose
      }, "Cancel"), /*#__PURE__*/React.createElement(Button, {
        variant: "primary",
        onClick: () => onSave({
          employeeName: employee,
          time: `${start} – ${end}`
        })
      }, "Save"))
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 14
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13,
        color: "var(--text-secondary)"
      }
    }, role, " \xB7 ", day), existing && existing.status === "conflict" && existing.conflictReason && /*#__PURE__*/React.createElement(ConflictChip, null, existing.conflictReason), /*#__PURE__*/React.createElement(Select, {
      label: "Employee",
      value: employee,
      onChange: setEmployee,
      placeholder: "Open shift (unassigned)",
      options: EMPLOYEES.map(e => ({
        value: e,
        label: e
      }))
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 10
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1
      }
    }, /*#__PURE__*/React.createElement(Input, {
      label: "Start",
      placeholder: "7:00 AM",
      value: start,
      onChange: e => setStart(e.target.value)
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1
      }
    }, /*#__PURE__*/React.createElement(Input, {
      label: "End",
      placeholder: "3:00 PM",
      value: end,
      onChange: e => setEnd(e.target.value)
    })))));
  }
  window.__rhManagerAssignDialog = {
    AssignShiftDialog
  };
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/manager-web/AssignShiftDialog.jsx", error: String((e && e.message) || e) }); }

// ui_kits/manager-web/AvailabilityOverview.jsx
try { (() => {
(function () {
  const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const TEAM_AVAILABILITY = [{
    name: "Maria Garcia",
    days: {
      Mon: true,
      Tue: true,
      Wed: true,
      Thu: true,
      Fri: true,
      Sat: false,
      Sun: false
    }
  }, {
    name: "Sam Torres",
    days: {
      Mon: false,
      Tue: true,
      Wed: true,
      Thu: false,
      Fri: true,
      Sat: true,
      Sun: true
    }
  }, {
    name: "Jordan Park",
    days: {
      Mon: true,
      Tue: true,
      Wed: false,
      Thu: true,
      Fri: true,
      Sat: false,
      Sun: false
    }
  }, {
    name: "Alex Kim",
    days: {
      Mon: false,
      Tue: false,
      Wed: true,
      Thu: true,
      Fri: true,
      Sat: true,
      Sun: false
    }
  }, {
    name: "Priya Shah",
    days: {
      Mon: true,
      Tue: false,
      Wed: false,
      Thu: true,
      Fri: false,
      Sat: true,
      Sun: true
    }
  }];
  function AvailabilityOverview() {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: "var(--font-sans)"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: "var(--text-h1-size)",
        fontWeight: "var(--text-h1-weight)",
        color: "var(--text-primary)",
        marginBottom: 6
      }
    }, "Team availability"), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13,
        color: "var(--text-secondary)",
        marginBottom: 18
      }
    }, "See who's available before you build next week's schedule."), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "grid",
        gridTemplateColumns: "160px repeat(7, 1fr)",
        gap: 8,
        alignItems: "center"
      }
    }, /*#__PURE__*/React.createElement("div", null), DAYS.map(d => /*#__PURE__*/React.createElement("div", {
      key: d,
      style: {
        fontSize: 12,
        fontWeight: 700,
        color: "var(--text-secondary)",
        textAlign: "center"
      }
    }, d)), TEAM_AVAILABILITY.map(person => /*#__PURE__*/React.createElement(React.Fragment, {
      key: person.name
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 14,
        fontWeight: 600,
        color: "var(--text-primary)"
      }
    }, person.name), DAYS.map(d => /*#__PURE__*/React.createElement("div", {
      key: d,
      style: {
        height: 34,
        borderRadius: "var(--radius-sm)",
        background: person.days[d] ? "var(--status-success-bg)" : "var(--surface-sunken)",
        border: `1px solid ${person.days[d] ? "var(--green-300)" : "var(--border-default)"}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }
    }, person.days[d] && /*#__PURE__*/React.createElement("span", {
      style: {
        width: 8,
        height: 8,
        borderRadius: "50%",
        background: "var(--status-success)"
      }
    })))))));
  }
  window.__rhManagerAvailability = {
    AvailabilityOverview
  };
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/manager-web/AvailabilityOverview.jsx", error: String((e && e.message) || e) }); }

// ui_kits/manager-web/DashboardScreen.jsx
try { (() => {
(function () {
  const {
    Card,
    Badge,
    AvatarStatus,
    ConflictChip
  } = window.RosterHouseDesignSystem_17c92d;
  function StatCard({
    label,
    value,
    tone
  }) {
    return /*#__PURE__*/React.createElement(Card, {
      style: {
        flex: 1
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: "var(--font-sans)"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13,
        color: "var(--text-secondary)",
        fontWeight: 600
      }
    }, label), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 28,
        fontWeight: 800,
        color: tone || "var(--text-primary)",
        marginTop: 6
      }
    }, value)));
  }
  function DashboardScreen({
    conflictCount,
    onGoSchedule,
    onGoTimeOff,
    onGoSwaps
  }) {
    const clockedIn = [{
      name: "Maria Garcia",
      role: "Line cook"
    }, {
      name: "Alex Kim",
      role: "Host"
    }];
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-6)",
        fontFamily: "var(--font-sans)"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: "var(--text-h1-size)",
        fontWeight: "var(--text-h1-weight)",
        color: "var(--text-primary)"
      }
    }, "Good afternoon, Jamie"), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 12
      }
    }, /*#__PURE__*/React.createElement(StatCard, {
      label: "Coverage gaps this week",
      value: "2",
      tone: "var(--status-warning)"
    }), /*#__PURE__*/React.createElement(StatCard, {
      label: "Pending requests",
      value: "3"
    }), /*#__PURE__*/React.createElement(StatCard, {
      label: "Projected labor cost",
      value: "$4,120"
    }), /*#__PURE__*/React.createElement(StatCard, {
      label: "Clocked in now",
      value: clockedIn.length,
      tone: "var(--status-success)"
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 14
      }
    }, /*#__PURE__*/React.createElement(Card, {
      style: {
        flex: 1
      },
      hoverable: true
    }, /*#__PURE__*/React.createElement("div", {
      onClick: onGoSchedule,
      style: {
        cursor: "pointer"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontWeight: 700,
        color: "var(--text-primary)"
      }
    }, "2 shifts have conflicts"), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13,
        color: "var(--text-secondary)",
        marginTop: 4
      }
    }, "Resolve before you publish this week's schedule."), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 10
      }
    }, /*#__PURE__*/React.createElement(ConflictChip, null, "View in Schedule Builder")))), /*#__PURE__*/React.createElement(Card, {
      style: {
        flex: 1
      },
      hoverable: true
    }, /*#__PURE__*/React.createElement("div", {
      onClick: onGoTimeOff,
      style: {
        cursor: "pointer"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontWeight: 700,
        color: "var(--text-primary)"
      }
    }, "2 time-off requests waiting"), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13,
        color: "var(--text-secondary)",
        marginTop: 4
      }
    }, "Sam Torres, Alex Kim are waiting on a decision."), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 10
      }
    }, /*#__PURE__*/React.createElement(Badge, {
      tone: "warning"
    }, "Needs review")))), /*#__PURE__*/React.createElement(Card, {
      style: {
        flex: 1
      },
      hoverable: true
    }, /*#__PURE__*/React.createElement("div", {
      onClick: onGoSwaps,
      style: {
        cursor: "pointer"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontWeight: 700,
        color: "var(--text-primary)"
      }
    }, "1 swap request"), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13,
        color: "var(--text-secondary)",
        marginTop: 4
      }
    }, "Priya Shah wants to swap her Saturday shift."), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 10
      }
    }, /*#__PURE__*/React.createElement(Badge, {
      tone: "info"
    }, "Needs review"))))), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: "var(--text-h3-size)",
        fontWeight: 700,
        color: "var(--text-primary)"
      }
    }, "Clocked in now"), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 10
      }
    }, clockedIn.map(c => /*#__PURE__*/React.createElement(Card, {
      key: c.name,
      style: {
        display: "flex",
        alignItems: "center",
        gap: 12,
        width: 220
      }
    }, /*#__PURE__*/React.createElement(AvatarStatus, {
      name: c.name,
      status: "available"
    }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      style: {
        fontWeight: 600,
        color: "var(--text-primary)"
      }
    }, c.name), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13,
        color: "var(--text-secondary)"
      }
    }, c.role))))));
  }
  window.__rhManagerDashboard = {
    DashboardScreen
  };
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/manager-web/DashboardScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/manager-web/ManagerApp.jsx
try { (() => {
(function () {
  const {
    Sidebar
  } = window.__rhManagerSidebar;
  const {
    WeekGrid
  } = window.__rhManagerWeekGrid;
  const {
    AssignShiftDialog
  } = window.__rhManagerAssignDialog;
  const {
    DashboardScreen
  } = window.__rhManagerDashboard;
  const {
    AvailabilityOverview
  } = window.__rhManagerAvailability;
  const {
    SwapApprovals
  } = window.__rhManagerSwaps;
  const {
    ScheduleView
  } = window.__rhManagerScheduleView;
  const {
    Button,
    Badge,
    ConflictChip,
    AvatarStatus,
    Card,
    Toast,
    Dialog
  } = window.RosterHouseDesignSystem_17c92d;
  const INITIAL_SHIFTS = {
    "Line cook|Mon 6": [{
      role: "Line cook",
      time: "7:00 AM – 3:00 PM",
      employeeName: "Maria Garcia",
      status: "confirmed"
    }],
    "Line cook|Tue 7": [{
      role: "Line cook",
      time: "7:00 AM – 3:00 PM",
      employeeName: "Maria Garcia",
      status: "confirmed"
    }],
    "Line cook|Wed 8": [{
      role: "Line cook",
      time: "7:00 AM – 3:00 PM",
      employeeName: "Diego Ramirez",
      status: "confirmed"
    }],
    "Line cook|Thu 9": [{
      role: "Line cook",
      time: "7:00 AM – 3:00 PM",
      employeeName: "Maria Garcia",
      status: "confirmed"
    }],
    "Line cook|Fri 10": [{
      role: "Line cook",
      time: "7:00 AM – 3:00 PM",
      employeeName: "Maria Garcia",
      status: "confirmed"
    }, {
      role: "Line cook",
      time: "3:00 PM – 11:00 PM",
      employeeName: "Diego Ramirez",
      status: "confirmed"
    }],
    "Line cook|Sat 11": [{
      role: "Line cook",
      time: "9:00 AM – 5:00 PM",
      employeeName: "Diego Ramirez",
      status: "confirmed"
    }],
    "Server|Mon 6": [{
      role: "Server",
      time: "11:00 AM – 4:00 PM",
      employeeName: "Sam Torres",
      status: "confirmed"
    }, {
      role: "Server",
      time: "4:00 PM – 10:00 PM",
      employeeName: "Priya Shah",
      status: "confirmed"
    }, {
      role: "Server",
      time: "4:00 PM – 10:00 PM",
      status: "open"
    }],
    "Server|Tue 7": [{
      role: "Server",
      time: "11:00 AM – 4:00 PM",
      employeeName: "Chloe Nguyen",
      status: "confirmed"
    }, {
      role: "Server",
      time: "4:00 PM – 10:00 PM",
      employeeName: "Sam Torres",
      status: "confirmed"
    }],
    "Server|Wed 8": [{
      role: "Server",
      time: "2:00 PM – 6:00 PM",
      employeeName: "Sam Torres",
      status: "conflict",
      conflictReason: "Overlaps Sam's 5–11 PM Dishwasher shift the same day"
    }, {
      role: "Server",
      time: "6:00 PM – 10:00 PM",
      employeeName: "Chloe Nguyen",
      status: "confirmed"
    }],
    "Server|Thu 9": [{
      role: "Server",
      time: "11:00 AM – 4:00 PM",
      employeeName: "Priya Shah",
      status: "confirmed"
    }, {
      role: "Server",
      time: "4:00 PM – 10:00 PM",
      employeeName: "Marcus Bell",
      status: "confirmed"
    }, {
      role: "Server",
      time: "4:00 PM – 10:00 PM",
      status: "open"
    }],
    "Server|Fri 10": [{
      role: "Server",
      time: "11:00 AM – 4:00 PM",
      employeeName: "Sam Torres",
      status: "confirmed"
    }, {
      role: "Server",
      time: "11:00 AM – 4:00 PM",
      employeeName: "Priya Shah",
      status: "confirmed"
    }, {
      role: "Server",
      time: "4:00 PM – 10:00 PM",
      employeeName: "Chloe Nguyen",
      status: "confirmed"
    }, {
      role: "Server",
      time: "4:00 PM – 10:00 PM",
      employeeName: "Marcus Bell",
      status: "confirmed"
    }, {
      role: "Server",
      time: "4:00 PM – 10:00 PM",
      employeeName: "Taylor Osei",
      status: "draft"
    }, {
      role: "Server",
      time: "6:00 PM – 11:00 PM",
      employeeName: "Grace Lin",
      status: "confirmed"
    }, {
      role: "Server",
      time: "6:00 PM – 11:00 PM",
      status: "open"
    }],
    "Server|Sat 11": [{
      role: "Server",
      time: "11:00 AM – 4:00 PM",
      employeeName: "Sam Torres",
      status: "confirmed"
    }, {
      role: "Server",
      time: "11:00 AM – 4:00 PM",
      employeeName: "Priya Shah",
      status: "confirmed"
    }, {
      role: "Server",
      time: "4:00 PM – 10:00 PM",
      employeeName: "Chloe Nguyen",
      status: "confirmed"
    }, {
      role: "Server",
      time: "4:00 PM – 10:00 PM",
      employeeName: "Marcus Bell",
      status: "confirmed"
    }],
    "Server|Sun 12": [{
      role: "Server",
      time: "11:00 AM – 4:00 PM",
      employeeName: "Priya Shah",
      status: "confirmed"
    }, {
      role: "Server",
      time: "4:00 PM – 9:00 PM",
      employeeName: "Taylor Osei",
      status: "confirmed"
    }, {
      role: "Server",
      time: "4:00 PM – 9:00 PM",
      employeeName: "Grace Lin",
      status: "confirmed"
    }],
    "Dishwasher|Wed 8": [{
      role: "Dishwasher",
      time: "5:00 PM – 11:00 PM",
      employeeName: "Sam Torres",
      status: "conflict",
      conflictReason: "Overlaps Sam's 2–6 PM Server shift the same day"
    }],
    "Dishwasher|Thu 9": [{
      role: "Dishwasher",
      time: "6:00 PM – 12:00 AM",
      employeeName: "Jordan Park",
      status: "draft"
    }],
    "Dishwasher|Fri 10": [{
      role: "Dishwasher",
      time: "11:00 AM – 5:00 PM",
      employeeName: "Jordan Park",
      status: "confirmed"
    }, {
      role: "Dishwasher",
      time: "5:00 PM – 12:00 AM",
      employeeName: "Alex Kim",
      status: "confirmed"
    }],
    "Host|Fri 10": [{
      role: "Host",
      time: "11:00 AM – 3:00 PM",
      employeeName: "Alex Kim",
      status: "confirmed"
    }],
    "Host|Sat 11": [{
      role: "Host",
      time: "11:00 AM – 3:00 PM",
      employeeName: "Alex Kim",
      status: "confirmed"
    }]
  };
  const TEAM = [{
    name: "Maria Garcia",
    role: "Line cook",
    status: "available"
  }, {
    name: "Sam Torres",
    role: "Server",
    status: "unavailable"
  }, {
    name: "Jordan Park",
    role: "Dishwasher",
    status: "available"
  }, {
    name: "Alex Kim",
    role: "Host",
    status: "pending"
  }, {
    name: "Priya Shah",
    role: "Server",
    status: "off"
  }, {
    name: "Diego Ramirez",
    role: "Line cook",
    status: "available"
  }, {
    name: "Chloe Nguyen",
    role: "Server",
    status: "available"
  }, {
    name: "Marcus Bell",
    role: "Server",
    status: "available"
  }, {
    name: "Taylor Osei",
    role: "Server",
    status: "pending"
  }, {
    name: "Grace Lin",
    role: "Server",
    status: "available"
  }];
  const TIME_OFF = [{
    name: "Sam Torres",
    range: "Jul 14 – Jul 16",
    reason: "Family trip"
  }, {
    name: "Alex Kim",
    range: "Jul 20",
    reason: "Doctor appointment"
  }];
  function ManagerApp() {
    const [nav, setNav] = React.useState("dashboard");
    React.useEffect(() => {
      window.lucide && window.lucide.createIcons();
    });
    const [shifts, setShifts] = React.useState(INITIAL_SHIFTS);
    const [dialog, setDialog] = React.useState(null); // { role, day, existing }
    const [publishOpen, setPublishOpen] = React.useState(false);
    const [toast, setToast] = React.useState(null);
    const [published, setPublished] = React.useState(false);
    const conflictCount = Object.values(shifts).flat().filter(s => s.status === "conflict").length;
    function cellClick(role, day, existing, index) {
      setDialog({
        role,
        day,
        existing,
        index
      });
    }
    function saveShift(patch) {
      const key = `${dialog.role}|${dialog.day}`;
      setShifts(s => {
        const list = s[key] ? [...s[key]] : [];
        const entry = {
          role: dialog.role,
          time: patch.time,
          employeeName: patch.employeeName || undefined,
          status: patch.employeeName ? "draft" : "open"
        };
        if (dialog.index != null) {
          list[dialog.index] = entry;
        } else {
          list.push(entry);
        }
        return {
          ...s,
          [key]: list
        };
      });
      setDialog(null);
    }
    function deleteShift() {
      const key = `${dialog.role}|${dialog.day}`;
      setShifts(s => {
        const list = (s[key] || []).filter((_, i) => i !== dialog.index);
        const next = {
          ...s
        };
        if (list.length) next[key] = list;else delete next[key];
        return next;
      });
      setDialog(null);
    }
    function publish() {
      setShifts(s => {
        const next = {};
        Object.entries(s).forEach(([k, list]) => {
          next[k] = list.map(v => ({
            ...v,
            status: v.status === "draft" ? "confirmed" : v.status
          }));
        });
        return next;
      });
      setPublished(true);
      setPublishOpen(false);
      setToast({
        title: "Schedule published",
        description: "10 employees notified by push and text"
      });
      setTimeout(() => setToast(null), 3500);
    }
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        height: "100%",
        minHeight: 720,
        background: "var(--surface-page)"
      }
    }, /*#__PURE__*/React.createElement(Sidebar, {
      active: nav,
      onSelect: setNav,
      location: "Downtown location",
      onLocationClick: () => {}
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        display: "flex",
        flexDirection: "column",
        padding: "var(--space-8)",
        boxSizing: "border-box",
        overflow: "auto",
        position: "relative"
      }
    }, nav === "schedule" && /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: "var(--space-6)"
      }
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: "var(--text-h1-size)",
        fontWeight: "var(--text-h1-weight)",
        color: "var(--text-primary)",
        fontFamily: "var(--font-sans)"
      }
    }, "Schedule"), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 10,
        marginTop: 6
      }
    }, /*#__PURE__*/React.createElement(Badge, {
      tone: published ? "success" : "warning"
    }, published ? "Published" : "Draft"), conflictCount > 0 && /*#__PURE__*/React.createElement(ConflictChip, null, conflictCount, " conflict", conflictCount > 1 ? "s" : "", " to resolve"))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 10
      }
    }, /*#__PURE__*/React.createElement(Button, {
      variant: "secondary"
    }, "Add shift"), /*#__PURE__*/React.createElement(Button, {
      variant: "primary",
      onClick: () => setPublishOpen(true)
    }, "Publish schedule"))), nav === "dashboard" && /*#__PURE__*/React.createElement(DashboardScreen, {
      conflictCount: conflictCount,
      onGoSchedule: () => setNav("schedule"),
      onGoTimeOff: () => setNav("timeoff"),
      onGoSwaps: () => setNav("swaps")
    }), nav === "schedule" && /*#__PURE__*/React.createElement(ScheduleView, {
      shiftsByCell: shifts,
      onCellClick: cellClick
    }), nav === "availability" && /*#__PURE__*/React.createElement(AvailabilityOverview, null), nav === "swaps" && /*#__PURE__*/React.createElement(SwapApprovals, null), nav === "team" && /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 10
      }
    }, TEAM.map(t => /*#__PURE__*/React.createElement(Card, {
      key: t.name,
      style: {
        display: "flex",
        alignItems: "center",
        gap: 14
      }
    }, /*#__PURE__*/React.createElement(AvatarStatus, {
      name: t.name,
      status: t.status
    }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      style: {
        fontWeight: 600,
        color: "var(--text-primary)",
        fontFamily: "var(--font-sans)"
      }
    }, t.name), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13,
        color: "var(--text-secondary)",
        fontFamily: "var(--font-sans)"
      }
    }, t.role))))), nav === "timeoff" && /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 10
      }
    }, TIME_OFF.map(r => /*#__PURE__*/React.createElement(Card, {
      key: r.name,
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between"
      }
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      style: {
        fontWeight: 600,
        color: "var(--text-primary)",
        fontFamily: "var(--font-sans)"
      }
    }, r.name), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13,
        color: "var(--text-secondary)",
        fontFamily: "var(--font-sans)"
      }
    }, r.range, " \xB7 ", r.reason)), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 8
      }
    }, /*#__PURE__*/React.createElement(Button, {
      variant: "ghost",
      size: "sm"
    }, "Deny"), /*#__PURE__*/React.createElement(Button, {
      variant: "secondary",
      size: "sm"
    }, "Approve"))))), toast && /*#__PURE__*/React.createElement("div", {
      style: {
        position: "fixed",
        bottom: 24,
        right: 24,
        zIndex: 200
      }
    }, /*#__PURE__*/React.createElement(Toast, {
      tone: "success",
      title: toast.title,
      description: toast.description,
      onClose: () => setToast(null)
    }))), /*#__PURE__*/React.createElement(AssignShiftDialog, {
      open: !!dialog,
      role: dialog && dialog.role,
      day: dialog && dialog.day,
      existing: dialog && dialog.existing,
      onClose: () => setDialog(null),
      onSave: saveShift,
      onDelete: deleteShift
    }), publishOpen && /*#__PURE__*/React.createElement(Dialog, {
      open: publishOpen,
      onClose: () => setPublishOpen(false),
      title: "Publish this week's schedule?",
      footer: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Button, {
        variant: "ghost",
        onClick: () => setPublishOpen(false)
      }, "Cancel"), /*#__PURE__*/React.createElement(Button, {
        variant: "primary",
        onClick: publish
      }, "Publish"))
    }, "5 employees will be notified by push and text as soon as you publish."));
  }
  window.__rh_manager = {
    ManagerApp
  };
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/manager-web/ManagerApp.jsx", error: String((e && e.message) || e) }); }

// ui_kits/manager-web/ScheduleView.jsx
try { (() => {
(function () {
  const {
    WeekGrid,
    ROLES
  } = window.__rhManagerWeekGrid;
  const {
    ShiftBlock,
    Button,
    Tabs,
    Badge
  } = window.RosterHouseDesignSystem_17c92d;

  // Mon Jul 6, 2026 — week offset 0. Matches the demo shift data's day keys ("Mon 6" … "Sun 12").
  const ANCHOR = new Date(2026, 6, 6);
  const WEEKDAY_ABBR = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  function addDays(date, n) {
    const d = new Date(date);
    d.setDate(d.getDate() + n);
    return d;
  }
  function dayKeyOf(date) {
    return `${WEEKDAY_ABBR[date.getDay()]} ${date.getDate()}`;
  }
  function fmtShort(date) {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric"
    });
  }
  function addButton(onClick, label) {
    return /*#__PURE__*/React.createElement("div", {
      onClick: onClick,
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
        padding: "7px 0",
        borderRadius: "var(--radius-sm)",
        border: "1px dashed var(--border-strong)",
        color: "var(--text-tertiary)",
        fontSize: 12,
        fontWeight: 600,
        cursor: "pointer"
      }
    }, label);
  }
  function DayView({
    dayKey,
    shiftsByCell,
    onCellClick
  }) {
    const rows = ROLES.map(role => ({
      role,
      shifts: shiftsByCell[`${role}|${dayKey}`] || []
    }));
    const total = rows.reduce((sum, r) => sum + r.shifts.length, 0);
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 20,
        fontFamily: "var(--font-sans)"
      }
    }, total === 0 && /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 14,
        color: "var(--text-tertiary)"
      }
    }, "No shifts scheduled for this day yet."), rows.map(r => /*#__PURE__*/React.createElement("div", {
      key: r.role
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13,
        fontWeight: 700,
        color: "var(--text-secondary)",
        marginBottom: 8
      }
    }, r.role, " ", r.shifts.length > 0 && `· ${r.shifts.length}`), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 8,
        maxWidth: 460
      }
    }, r.shifts.map((shift, idx) => /*#__PURE__*/React.createElement(ShiftBlock, {
      key: idx,
      role: shift.role,
      time: shift.time,
      employeeName: shift.employeeName,
      status: shift.status,
      conflictReason: shift.conflictReason,
      onClick: () => onCellClick(r.role, dayKey, shift, idx)
    })), addButton(() => onCellClick(r.role, dayKey, null, null), `+ Add ${r.role} shift`)))));
  }
  function MonthView({
    monthDate,
    shiftsByCell,
    onSelectDay
  }) {
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    const startWeekday = (firstOfMonth.getDay() + 6) % 7; // Monday = 0
    const gridStart = addDays(firstOfMonth, -startWeekday);
    const cells = Array.from({
      length: 42
    }, (_, i) => addDays(gridStart, i));
    function countForDay(date) {
      const key = dayKeyOf(date);
      return ROLES.reduce((sum, role) => sum + (shiftsByCell[`${role}|${key}`] || []).length, 0);
    }
    return /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: "var(--font-sans)"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "grid",
        gridTemplateColumns: "repeat(7, 1fr)",
        gap: 8,
        marginBottom: 8
      }
    }, ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(d => /*#__PURE__*/React.createElement("div", {
      key: d,
      style: {
        fontSize: 12,
        fontWeight: 700,
        color: "var(--text-secondary)",
        textAlign: "center"
      }
    }, d))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "grid",
        gridTemplateColumns: "repeat(7, 1fr)",
        gap: 8
      }
    }, cells.map((date, i) => {
      const inMonth = date.getMonth() === month;
      const count = countForDay(date);
      return /*#__PURE__*/React.createElement("div", {
        key: i,
        onClick: () => onSelectDay(date),
        style: {
          minHeight: 78,
          borderRadius: "var(--radius-md)",
          border: "1px solid var(--border-default)",
          padding: 8,
          cursor: "pointer",
          background: inMonth ? "var(--surface-card)" : "var(--surface-sunken)",
          opacity: inMonth ? 1 : 0.5,
          display: "flex",
          flexDirection: "column",
          gap: 6
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          fontSize: 13,
          fontWeight: 600,
          color: "var(--text-primary)"
        }
      }, date.getDate()), count > 0 && /*#__PURE__*/React.createElement(Badge, {
        tone: "success"
      }, count, " shift", count > 1 ? "s" : ""));
    })));
  }
  function ScheduleView({
    shiftsByCell,
    onCellClick
  }) {
    const [mode, setMode] = React.useState("week");
    const [offset, setOffset] = React.useState(0);
    function switchMode(m) {
      setMode(m);
      setOffset(0);
    }
    let periodLabel = "";
    let body = null;
    if (mode === "week") {
      const weekStart = addDays(ANCHOR, offset * 7);
      const days = Array.from({
        length: 7
      }, (_, i) => dayKeyOf(addDays(weekStart, i)));
      periodLabel = `${fmtShort(weekStart)} – ${fmtShort(addDays(weekStart, 6))}`;
      body = /*#__PURE__*/React.createElement(WeekGrid, {
        days: days,
        shiftsByCell: shiftsByCell,
        onCellClick: onCellClick
      });
    } else if (mode === "day") {
      const date = addDays(ANCHOR, offset);
      periodLabel = date.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric"
      });
      body = /*#__PURE__*/React.createElement(DayView, {
        dayKey: dayKeyOf(date),
        shiftsByCell: shiftsByCell,
        onCellClick: onCellClick
      });
    } else {
      const monthDate = new Date(ANCHOR.getFullYear(), ANCHOR.getMonth() + offset, 1);
      periodLabel = monthDate.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric"
      });
      body = /*#__PURE__*/React.createElement(MonthView, {
        monthDate: monthDate,
        shiftsByCell: shiftsByCell,
        onSelectDay: date => {
          setMode("day");
          setOffset(Math.round((date - ANCHOR) / (1000 * 60 * 60 * 24)));
        }
      });
    }
    return /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: "var(--font-sans)"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 18,
        flexWrap: "wrap",
        gap: 12
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 8
      }
    }, /*#__PURE__*/React.createElement(Button, {
      variant: "ghost",
      size: "sm",
      onClick: () => setOffset(o => o - 1)
    }, /*#__PURE__*/React.createElement("i", {
      "data-lucide": "chevron-left",
      style: {
        width: 16,
        height: 16
      }
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        fontWeight: 700,
        fontSize: 16,
        color: "var(--text-primary)",
        minWidth: 190,
        textAlign: "center"
      }
    }, periodLabel), /*#__PURE__*/React.createElement(Button, {
      variant: "ghost",
      size: "sm",
      onClick: () => setOffset(o => o + 1)
    }, /*#__PURE__*/React.createElement("i", {
      "data-lucide": "chevron-right",
      style: {
        width: 16,
        height: 16
      }
    })), /*#__PURE__*/React.createElement(Button, {
      variant: "secondary",
      size: "sm",
      onClick: () => setOffset(0)
    }, "Today")), /*#__PURE__*/React.createElement(Tabs, {
      value: mode,
      tabs: [{
        value: "day",
        label: "Day"
      }, {
        value: "week",
        label: "Week"
      }, {
        value: "month",
        label: "Month"
      }],
      onChange: switchMode
    })), body);
  }
  window.__rhManagerScheduleView = {
    ScheduleView
  };
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/manager-web/ScheduleView.jsx", error: String((e && e.message) || e) }); }

// ui_kits/manager-web/Sidebar.jsx
try { (() => {
(function () {
  const NAV = [{
    key: "dashboard",
    label: "Dashboard",
    icon: "layout-dashboard"
  }, {
    key: "schedule",
    label: "Schedule",
    icon: "calendar"
  }, {
    key: "team",
    label: "Team",
    icon: "users"
  }, {
    key: "availability",
    label: "Availability",
    icon: "calendar-check"
  }, {
    key: "timeoff",
    label: "Time off",
    icon: "clock"
  }, {
    key: "swaps",
    label: "Swaps & open shifts",
    icon: "repeat"
  }];
  function Sidebar({
    active,
    onSelect,
    location,
    onLocationClick
  }) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        width: 232,
        flex: "none",
        background: "var(--surface-brand)",
        color: "var(--text-inverse)",
        display: "flex",
        flexDirection: "column",
        padding: "var(--space-6) var(--space-5)",
        gap: "var(--space-8)",
        fontFamily: "var(--font-sans)",
        boxSizing: "border-box"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 22,
        fontWeight: 800,
        letterSpacing: "-0.01em"
      }
    }, "RosterHouse"), /*#__PURE__*/React.createElement("div", {
      onClick: onLocationClick,
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px 12px",
        borderRadius: "var(--radius-md)",
        background: "rgba(255,255,255,0.08)",
        cursor: "pointer",
        fontSize: 13,
        fontWeight: 600
      }
    }, /*#__PURE__*/React.createElement("span", null, location), /*#__PURE__*/React.createElement("i", {
      "data-lucide": "chevron-right",
      style: {
        width: 14,
        height: 14
      }
    })), /*#__PURE__*/React.createElement("nav", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 2
      }
    }, NAV.map(n => /*#__PURE__*/React.createElement("div", {
      key: n.key,
      onClick: () => onSelect(n.key),
      style: {
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 12px",
        borderRadius: "var(--radius-md)",
        fontSize: 14,
        fontWeight: 600,
        cursor: "pointer",
        background: active === n.key ? "rgba(255,255,255,0.14)" : "transparent",
        transition: "background var(--duration-fast) var(--ease-out)"
      }
    }, /*#__PURE__*/React.createElement("i", {
      "data-lucide": n.icon,
      style: {
        width: 18,
        height: 18
      }
    }), n.label))), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: "auto",
        display: "flex",
        alignItems: "center",
        gap: 10
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: 34,
        height: 34,
        borderRadius: "50%",
        background: "rgba(255,255,255,0.15)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 13,
        fontWeight: 700
      }
    }, "JP"), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13,
        fontWeight: 600
      }
    }, "Jamie Park")));
  }
  window.__rhManagerSidebar = {
    Sidebar
  };
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/manager-web/Sidebar.jsx", error: String((e && e.message) || e) }); }

// ui_kits/manager-web/SwapApprovals.jsx
try { (() => {
(function () {
  const {
    useState
  } = React;
  const {
    Card,
    Button,
    AvatarStatus,
    Badge
  } = window.RosterHouseDesignSystem_17c92d;
  const INITIAL_REQUESTS = [{
    id: 1,
    type: "swap",
    name: "Priya Shah",
    detail: "Wants to swap her Sat Jul 12, 4–10 PM Server shift",
    covering: "Open to anyone qualified"
  }, {
    id: 2,
    type: "open",
    name: "Unfilled",
    detail: "Sun Jul 13, 6 PM–12 AM Dishwasher — claimed by Alex Kim",
    covering: "Awaiting your approval"
  }];
  function SwapApprovals() {
    const [requests, setRequests] = useState(INITIAL_REQUESTS);
    function decide(id) {
      setRequests(r => r.filter(req => req.id !== id));
    }
    return /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: "var(--font-sans)"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: "var(--text-h1-size)",
        fontWeight: "var(--text-h1-weight)",
        color: "var(--text-primary)",
        marginBottom: 6
      }
    }, "Swaps & open shifts"), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13,
        color: "var(--text-secondary)",
        marginBottom: 18
      }
    }, "Approve shift swaps and claims before they take effect."), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 10
      }
    }, requests.length === 0 && /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 14,
        color: "var(--text-tertiary)"
      }
    }, "All caught up \u2014 no pending requests."), requests.map(r => /*#__PURE__*/React.createElement(Card, {
      key: r.id,
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 14
      }
    }, /*#__PURE__*/React.createElement(AvatarStatus, {
      name: r.name === "Unfilled" ? "Open Shift" : r.name,
      status: "pending"
    }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 8
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontWeight: 700,
        color: "var(--text-primary)"
      }
    }, r.name), /*#__PURE__*/React.createElement(Badge, {
      tone: r.type === "swap" ? "info" : "warning"
    }, r.type === "swap" ? "Swap" : "Open shift")), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13,
        color: "var(--text-secondary)",
        marginTop: 2
      }
    }, r.detail))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 8
      }
    }, /*#__PURE__*/React.createElement(Button, {
      variant: "ghost",
      size: "sm",
      onClick: () => decide(r.id)
    }, "Deny"), /*#__PURE__*/React.createElement(Button, {
      variant: "secondary",
      size: "sm",
      onClick: () => decide(r.id)
    }, "Approve"))))));
  }
  window.__rhManagerSwaps = {
    SwapApprovals
  };
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/manager-web/SwapApprovals.jsx", error: String((e && e.message) || e) }); }

// ui_kits/manager-web/WeekGrid.jsx
try { (() => {
(function () {
  const {
    ShiftBlock,
    WeekGridCell
  } = window.RosterHouseDesignSystem_17c92d;
  const ROLES = ["Line cook", "Server", "Dishwasher", "Host"];
  function WeekGrid({
    days,
    shiftsByCell,
    onCellClick
  }) {
    const DAYS = days;
    return /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: "var(--font-sans)"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "grid",
        gridTemplateColumns: "110px repeat(7, minmax(128px, 1fr))",
        position: "sticky",
        top: 0,
        background: "var(--surface-page)",
        zIndex: 2,
        paddingBottom: 8
      }
    }, /*#__PURE__*/React.createElement("div", null), DAYS.map(d => /*#__PURE__*/React.createElement("div", {
      key: d,
      style: {
        fontSize: 13,
        fontWeight: 700,
        color: "var(--text-primary)",
        textAlign: "center"
      }
    }, d))), ROLES.map(role => /*#__PURE__*/React.createElement("div", {
      key: role,
      style: {
        display: "grid",
        gridTemplateColumns: "110px repeat(7, minmax(128px, 1fr))",
        gap: 8,
        marginBottom: 8
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13,
        fontWeight: 600,
        color: "var(--text-secondary)",
        display: "flex",
        alignItems: "flex-start",
        paddingTop: 6
      }
    }, role), DAYS.map(day => {
      const key = `${role}|${day}`;
      const dayShifts = shiftsByCell[key] || [];
      const hasConflict = dayShifts.some(s => s.status === "conflict");
      return /*#__PURE__*/React.createElement(WeekGridCell, {
        key: key,
        empty: dayShifts.length === 0,
        hasConflict: hasConflict,
        onClick: () => dayShifts.length === 0 && onCellClick(role, day, null, null)
      }, dayShifts.length > 0 && /*#__PURE__*/React.createElement("div", {
        style: {
          display: "flex",
          flexDirection: "column",
          gap: 6,
          width: "100%"
        }
      }, dayShifts.map((shift, idx) => /*#__PURE__*/React.createElement(ShiftBlock, {
        key: idx,
        compact: true,
        role: shift.role,
        time: shift.time,
        employeeName: shift.employeeName,
        status: shift.status,
        conflictReason: shift.conflictReason,
        onClick: () => onCellClick(role, day, shift, idx)
      })), /*#__PURE__*/React.createElement("div", {
        onClick: e => {
          e.stopPropagation();
          onCellClick(role, day, null, null);
        },
        style: {
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 4,
          padding: "5px 0",
          borderRadius: "var(--radius-sm)",
          border: "1px dashed var(--border-strong)",
          color: "var(--text-tertiary)",
          fontSize: 10.5,
          fontWeight: 600,
          cursor: "pointer"
        }
      }, "+ Add")));
    }))));
  }
  window.__rhManagerWeekGrid = {
    WeekGrid,
    ROLES
  };
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/manager-web/WeekGrid.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Card = __ds_scope.Card;

__ds_ns.Dialog = __ds_scope.Dialog;

__ds_ns.Tabs = __ds_scope.Tabs;

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Tag = __ds_scope.Tag;

__ds_ns.Toast = __ds_scope.Toast;

__ds_ns.Tooltip = __ds_scope.Tooltip;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Checkbox = __ds_scope.Checkbox;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.Select = __ds_scope.Select;

__ds_ns.Switch = __ds_scope.Switch;

__ds_ns.AvatarStatus = __ds_scope.AvatarStatus;

__ds_ns.ConflictChip = __ds_scope.ConflictChip;

__ds_ns.ShiftBlock = __ds_scope.ShiftBlock;

__ds_ns.WeekGridCell = __ds_scope.WeekGridCell;

})();
